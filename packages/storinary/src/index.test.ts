import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStorinaryClient,
  buildTransformQuery,
  StorinaryApiError,
  StorinaryClient,
  createUploadSignature,
  type AiInsight,
  type RestoreVersionResponse,
  type VideoClip,
  type StructuredMetadata,
} from './index';
const fetchMock = vi.fn();
const typedFetchMock = fetchMock as unknown as import('vitest').Mock;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function file() {
  return new File(['media'], 'asset.png', { type: 'image/png' });
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('@storinary/sdk', () => {
  it('creates a browser-compatible signature matching the server algorithm', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const { signature, timestamp } = await createUploadSignature(
      'stor_live_test',
      { folder: '/site', tags: 'hero' },
      1234
    );
    const canonical = 'folder=/site&tags=hero';
    const expected = createHmac('sha256', 'stor_live_test')
      .update(`${canonical}${timestamp}`)
      .digest('hex');

    expect(timestamp).toBe(1234);
    expect(signature).toBe(expected);
  });

  it('builds server-compatible transformation URLs', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example' });

    expect(buildTransformQuery({
      width: 640,
      height: 360,
      quality: 'auto',
      format: 'webp',
      fit: 'cover',
      gravity: 'center',
      aspectRatio: '16:9',
      background: '#ffffff',
      angle: 90,
      grayscale: true,
      blur: 25.4,
      brightness: 1.2,
      dpr: 'auto',
      namedTransform: 'hero',
      text: 'Hello',
      overlayId: 'overlay-1',
    })).toBe([
      'w=640&h=360&q=auto&fmt=webp&fit=cover&g=center&ar=16%3A9&b=%23ffffff&a=90',
      'e=grayscale&e=blur%3A25&brightness=1.2&dpr=auto&t=hero&text=Hello&overlay=overlay-1',
    ].join('&'));
    expect(client.transformUrl('2026/photo.png', { width: 300, format: 'avif' }))
      .toBe('https://media.example/serve/2026/photo.png?w=300&fmt=avif');
    expect(() => client.transformUrl({ id: 'one' }, {})).toThrow(StorinaryApiError);
  });

  it('sends signed upload credentials and signs only string metadata', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      images: [{ id: 'signed-1', publicUrl: 'https://cdn.example/signed.png' }],
      errors: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient();
    await client.uploadImage({
      file: file(),
      apiKey: 'stor_live_test',
      timestamp: 1234,
      signature: 'signature',
      folder: '/site',
    });

    const [, init] = fetchMock.mock.calls[0];
    const formData = init.body as FormData;
    expect(formData.get('api_key')).toBe('stor_live_test');
    expect(formData.get('timestamp')).toBe('1234');
    expect(formData.get('api_signature')).toBe('signature');
    expect(formData.get('folder')).toBe('/site');
  });

  it('uploads images and normalizes image resources', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      images: [{ id: 'image-1', publicUrl: 'https://cdn.example/image.png' }],
      errors: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example' });

    await expect(client.uploadImage({ file: file(), folder: '/site' })).resolves.toEqual({
      id: 'image-1',
      publicUrl: 'https://cdn.example/image.png',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://media.example/upload',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uploads videos with the video endpoint and scoped header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      videos: [{ public_id: 'video-1', secure_url: 'https://cdn.example/video.mp4' }],
      errors: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ apiKey: 'stor_live_video' });

    const resource = await client.uploadVideo({ file: new File(['x'], 'clip.mp4') });
    expect(resource.id).toBe('video-1');
    expect(resource.publicUrl).toBe('https://cdn.example/video.mp4');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ 'X-API-Key': 'stor_live_video' });
    expect((init.body as FormData).get('resource_type')).toBeNull();
  });

  it('lists, gets, updates, and destroys Cloudinary-compatible media resources', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ resources: [{ id: 'one' }], pagination: { nextCursor: 'next' } }))
      .mockResolvedValueOnce(jsonResponse({ resources: [{ id: 'two' }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ deleted: [{ id: 'two' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'key' });

    await client.listMedia({ limit: 10, cursor: 'cursor', folder: '/site', resourceType: 'all' });
    await expect(client.getResource('two')).resolves.toEqual(expect.objectContaining({ id: 'two' }));
    await client.updateMetadata('two', { altText: 'New text' }, { resourceType: 'video' });
    await client.destroy('two', { resourceType: 'video' });

    expect(fetchMock.mock.calls[0][0]).toContain('/v1/media?limit=10&resource_type=all');
    expect(fetchMock.mock.calls[1][0]).toBe('https://media.example/v1/media/two?resource_type=image');
    expect(fetchMock.mock.calls[2][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[2][1].body).toEqual(JSON.stringify({ altText: 'New text' }));
    expect(fetchMock.mock.calls[3][1].method).toBe('DELETE');
  });

  it('filters unified media by collection and manages collections', async () => {
    const collection = { id: 'collection-1', name: 'Launch' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ resources: [], pagination: { nextCursor: null } }))
      .mockResolvedValueOnce(jsonResponse({ collection }, 201))
      .mockResolvedValueOnce(jsonResponse({ collections: [collection] }))
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
        jsonResponse({ collection }, init?.method === 'PATCH' ? 200 : 200)
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'key' });

    await client.listMedia({ resourceType: 'all', collectionId: 'collection-1' });
    await expect(client.createCollection({ name: 'Launch' })).resolves.toEqual(collection);
    await expect(client.listCollections()).resolves.toEqual([collection]);
    await expect(client.addToCollection('collection-1', { imageIds: ['image-1'] }))
      .resolves.toEqual({ collection });
    await expect(client.removeFromCollection('collection-1', { videoIds: ['video-1'] }, { apiKey: 'scoped-key' }))
      .resolves.toEqual({ collection });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://media.example/v1/media?limit=20&resource_type=all&collection_id=collection-1'
    );
    expect(fetchMock.mock.calls[1]).toEqual([
      'https://media.example/collections',
      expect.objectContaining({ method: 'POST' }),
    ]);
    expect(fetchMock.mock.calls[2][0]).toBe('https://media.example/collections');
    expect(fetchMock.mock.calls[3]).toEqual([
      'https://media.example/collections/collection-1',
      expect.objectContaining({ method: 'PATCH' }),
    ]);
    expect(fetchMock.mock.calls[3][1].body).toBe(
      JSON.stringify({ action: 'add', imageIds: ['image-1'], videoIds: [] })
    );
    expect(fetchMock.mock.calls[4][0]).toBe('https://media.example/collections/collection-1');
    expect(fetchMock.mock.calls[4][1].headers).toEqual(
      expect.objectContaining({ 'X-API-Key': 'scoped-key' })
    );
  });

  it('throws typed API errors using nested upload errors when present', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({
      success: false,
      images: [],
      errors: [{ filename: 'auth', error: 'Invalid or revoked API key' }],
    }, 401).clone());
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient();

    await expect(client.uploadImage({ file: file() })).rejects.toThrow(StorinaryApiError);
    try {
      await client.uploadImage({ file: file() });
      expect.unreachable();
    } catch (error: unknown) {
      const apiError = error as StorinaryApiError;
      expect(apiError).toBeInstanceOf(StorinaryApiError);
      expect(apiError.status).toBe(401);
      expect(apiError.message).toBe('Invalid or revoked API key');
    }
  });

  it('analyzes images and videos through the AI endpoints', async () => {
    const insight = {
      provider: 'openai-compatible',
      model: 'vision-test',
      kind: 'tags,moderation',
      tags: ['city'],
      altText: null,
      moderationScore: 0,
      isSafe: true,
    } satisfies AiInsight;
    fetchMock.mockImplementation(async () =>
      jsonResponse({ insight }, 200).clone()
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'write-key' });

    await expect(client.analyzeImage('image-1', { moderation: true })).resolves.toMatchObject({
      insight: { model: 'vision-test', isSafe: true },
    });
    await expect(client.analyzeVideo('video-1', { replaceMetadata: true })).resolves.toMatchObject({
      insight: { tags: ['city'] },
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://media.example/images/image-1/ai?moderation=true'
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://media.example/videos/video-1/ai?replace_metadata=true'
    );
  });

  it('creates and lists structured metadata fields', async () => {
    const metadata = {
      campaign: 'spring',
      priority: 2,
      approved: true,
    } satisfies StructuredMetadata;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(
        String(input).endsWith('/metadata-fields') && init?.method === 'POST'
          ? { field: { id: 'field-1', externalId: 'campaign', label: 'Campaign', type: 'string', required: true, allowedValues: [], active: true } }
          : { fields: [] },
        init?.method === 'POST' ? 201 : 200
      ).clone()
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'write-key' });

    await expect(client.createMetadataField({
      externalId: 'campaign',
      label: 'Campaign',
      type: 'string',
      required: true,
    })).resolves.toMatchObject({ externalId: 'campaign' });
    await expect(client.listMetadataFields()).resolves.toEqual([]);

    expect(fetchMock.mock.calls[0][0]).toBe('https://media.example/metadata-fields');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('creates, lists, and deletes persistent video clips', async () => {
    const clip = {
      id: 'clip-1',
      videoId: 'video-1',
      name: 'intro',
      publicUrl: '/serve/videos/clips/intro.mp4',
      mimeType: 'video/mp4',
      startSeconds: 2,
      endSeconds: 7,
      durationSeconds: 5,
      muted: false,
      sourceLabel: null,
      fileSize: 123,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies VideoClip;

    typedFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(
        String(input).endsWith('/videos/video-1/clip') && init?.method === 'DELETE'
          ? { success: true, deleted: clip.name }
          : String(input).endsWith('/videos/video-1/clip') && init?.method === 'POST'
            ? { clip }
            : { clips: [clip] },
        init?.method === 'POST' ? 201 : 200
      ).clone()
    );
    vi.stubGlobal('fetch', typedFetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'write-key' });

    await expect(client.createVideoClip('video-1', {
      start: 2,
      duration: 5,
      name: 'intro',
    })).resolves.toEqual({ clip });
    await expect(client.listVideoClips('video-1')).resolves.toEqual([clip]);
    await expect(client.deleteVideoClip('video-1', 'intro')).resolves.toBeUndefined();

    const [createInput, createInit] = typedFetchMock.mock.calls[0];
    expect(createInput).toBe('https://media.example/videos/video-1/clip');
    expect(createInit.method).toBe('POST');
    expect(createInit.body).toEqual(JSON.stringify({
      start: 2,
      duration: 5,
      name: 'intro',
      persist: true,
    }));
    expect(typedFetchMock.mock.calls[1][0]).toBe('https://media.example/videos/video-1/clip');
    expect(typedFetchMock.mock.calls[2][0]).toBe('https://media.example/videos/video-1/clip/intro');
    expect(typedFetchMock.mock.calls[2][1].method).toBe('DELETE');
  });

  it('restores an asset version through the unified v1 API', async () => {
    const payload = {
      restoredVersion: { id: 'archive-2', version: 3 },
      resources: [{ id: 'video-1' }],
    } satisfies RestoreVersionResponse;
    typedFetchMock.mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal('fetch', typedFetchMock);
    const client = new StorinaryClient({ baseUrl: 'https://media.example', apiKey: 'write-key' });

    await expect(client.restoreVersion('video-1', {
      resourceType: 'video',
      versionId: 'version-1',
    })).resolves.toEqual(payload);

    expect(typedFetchMock).toHaveBeenCalledWith(
      'https://media.example/v1/media/video-1?resource_type=video',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(typedFetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ restoreVersionId: 'version-1' })
    );
  });
});
