// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';

const mocks = vi.hoisted(() => ({
  readAuth: vi.fn(),
  uploadAuth: vi.fn(),
  deleteAuth: vi.fn(),
  recordUsage: vi.fn(),
  imageFindMany: vi.fn(),
  videoFindMany: vi.fn(),
  collectionFindMany: vi.fn(),
  bulkDeleteFromStorage: vi.fn(),
  dispatchWebhooks: vi.fn(),
  imageDeleteMany: vi.fn(),
  videoDeleteMany: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({
  authorizeDashboardOrReadApiKey: mocks.readAuth,
  authorizeDashboardOrApiKey: mocks.uploadAuth,
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrDeleteApiKey: mocks.deleteAuth,
}));

vi.mock('@/lib/api-keys', () => ({ recordApiKeyUsage: mocks.recordUsage }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: {
      findMany: mocks.imageFindMany,
      deleteMany: mocks.imageDeleteMany,
    },
    video: {
      findMany: mocks.videoFindMany,
      deleteMany: mocks.videoDeleteMany,
    },
    collection: { findMany: mocks.collectionFindMany },
  },
}));

vi.mock('@/lib/storage', () => ({ bulkDeleteFromStorage: mocks.bulkDeleteFromStorage }));
vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: mocks.dispatchWebhooks }));

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${url}`, init);
}

beforeEach(() => {
  mocks.readAuth.mockReset().mockResolvedValue({ ok: true, keyId: null });
  mocks.uploadAuth.mockReset().mockResolvedValue({ ok: true, keyId: 'key-1' });
  mocks.deleteAuth.mockReset().mockResolvedValue({ ok: true, keyId: null });
  mocks.recordUsage.mockReset().mockResolvedValue(undefined);
  mocks.imageFindMany.mockReset().mockResolvedValue([]);
  mocks.videoFindMany.mockReset().mockResolvedValue([]);
  mocks.bulkDeleteFromStorage.mockReset().mockResolvedValue(undefined);
  mocks.dispatchWebhooks.mockReset();
  mocks.imageDeleteMany.mockReset().mockResolvedValue({ count: 0 });
  mocks.videoDeleteMany.mockReset().mockResolvedValue({ count: 0 });
  mocks.fetchMock.mockReset();
  vi.stubGlobal('fetch', mocks.fetchMock);
});

describe('/api/v1/media', () => {
  it('returns stable image resources and records keyed read usage', async () => {
    mocks.readAuth.mockResolvedValue({ ok: true, keyId: 'read-key' });
    mocks.imageFindMany.mockResolvedValue([
      {
        id: 'img-1',
        originalName: 'hero.png',
        storagePath: '/site/hero-id.png',
        publicUrl: 'https://cdn.example/hero.png',
        width: 10,
        height: 20,
        fileSize: 30,
        format: 'png',
        mimeType: 'image/png',
        folder: '/site',
        tags: 'hero,new',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);

    const response = await GET(request('/api/v1/media?limit=1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({
      id: 'img-1',
      publicId: '/site/hero-id',
      tags: ['hero', 'new'],
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith('read-key', 'read', { assets: 1 });
  });

  it('returns stable video resources with playback metadata', async () => {
    mocks.readAuth.mockResolvedValue({ ok: true, keyId: 'read-key' });
    mocks.videoFindMany.mockResolvedValue([
      {
        id: 'vid-1',
        originalName: 'clip.mp4',
        storagePath: 'site/clip-id.mp4',
        publicUrl: 'https://cdn.example/clip.mp4',
        mimeType: 'video/mp4',
        posterPath: 'site/clip-poster.webp',
        format: 'mp4',
        width: 1920,
        height: 1080,
        duration: 12.5,
        fileSize: 456,
        folder: '/site',
        tags: 'launch,hero',
        collections: [{ collection: { id: 'collection-1', name: 'Launch' } }],
        altText: '',
        status: 'ready',
        renditions: [{
          id: 'rendition-1',
          label: '720p',
          storagePath: 'site/clip-720.mp4',
          publicUrl: 'https://cdn.example/clip-720.mp4',
          width: 1280,
          height: 720,
          bitrateKbps: 2500,
          fileSize: 123,
          status: 'ready',
        }],
        createdAt: new Date('2026-02-01T00:00:00Z'),
        updatedAt: new Date('2026-02-01T00:00:00Z'),
      },
    ]);

    const response = await GET(request('/api/v1/media?resource_type=video'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({
      id: 'vid-1',
      resourceType: 'video',
      collections: [{ id: 'collection-1', name: 'Launch' }],
      playbackUrl: '/api/videos/vid-1/stream',
      posterUrl: '/api/videos/vid-1/poster',
    });
    expect(body.resources[0].renditions[0]).toMatchObject({
      label: '720p',
      playbackUrl: `/api/videos/vid-1/stream?rendition=${encodeURIComponent('720p')}`,
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith('read-key', 'read', { assets: 1 });
  });

  it('filters unified resources by collection membership', async () => {
    const response = await GET(request('/api/v1/media?resource_type=all&collection_id=collection-1&limit=10'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources).toEqual([]);
    expect(mocks.imageFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { collections: { some: { collectionId: 'collection-1' } } },
    }));
    expect(mocks.videoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { collections: { some: { collectionId: 'collection-1' } } },
    }));
  });

  it('merges and orders all resource types without cursor pagination', async () => {
    mocks.imageFindMany.mockResolvedValue([{
      id: 'img-old',
      originalName: 'old.png',
      storagePath: 'old-id.png',
      publicUrl: 'https://cdn.example/old.png',
      width: 10, height: 20, fileSize: 30,
      format: 'png', mimeType: 'image/png', folder: '/', tags: '',
      createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
    }]);
    mocks.videoFindMany.mockResolvedValue([{
      id: 'vid-new',
      originalName: 'new.mp4', storagePath: 'new-id.mp4',
      publicUrl: 'https://cdn.example/new.mp4', mimeType: 'video/mp4', posterPath: null,
      format: 'mp4', width: 100, height: 100, duration: 2, fileSize: 40,
      folder: '/', tags: '', altText: '', status: 'ready', renditions: [],
      createdAt: new Date('2026-03-01T00:00:00Z'), updatedAt: new Date('2026-03-01T00:00:00Z'),
    }]);

    const response = await GET(request('/api/v1/media?resource_type=all&limit=2'));
    const body = await response.json();

    expect(body.resources.map((item: { id: string }) => item.id)).toEqual(['vid-new', 'img-old']);
    expect(body.pagination.nextCursor).toBeNull();
    const imageArgs = mocks.imageFindMany.mock.calls[0][0];
    const videoArgs = mocks.videoFindMany.mock.calls[0][0];
    expect(imageArgs).not.toHaveProperty('cursor');
    expect(videoArgs).not.toHaveProperty('cursor');
  });

  it('rejects unsupported resource types', async () => {
    const response = await GET(request('/api/v1/media?resource_type=raw'));
    expect(response.status).toBe(400);
    expect(mocks.imageFindMany).not.toHaveBeenCalled();
  });

  it('requires authorization before listing resources', async () => {
    mocks.readAuth.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks read scope' });
    const response = await GET(request('/api/v1/media'));
    expect(response.status).toBe(403);
    expect(mocks.imageFindMany).not.toHaveBeenCalled();
  });

  it('uploads through the canonical image route with scoped credentials', async () => {
    const image = {
      id: 'img-2',
      originalName: 'new.png',
      publicUrl: 'https://cdn.example/new.png',
      width: 100,
      height: 50,
      fileSize: 123,
      format: 'png',
      mimeType: 'image/png',
      folder: '/v1',
      tags: 'hero',
      createdAt: new Date('2026-04-01T00:00:00Z'),
    };
    mocks.fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      images: [image],
      errors: [],
    }), { status: 200 }));

    const formData = new FormData();
    formData.set('file', new File(['image'], 'new.png', { type: 'image/png' }));
    formData.set('folder', '/v1');
    const response = await POST(request('/api/v1/media', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.resources[0]).toMatchObject({
      id: 'img-2',
      publicId: 'img-2',
      resourceType: 'image',
      url: image.publicUrl,
      public_id: 'img-2',
      secure_url: image.publicUrl,
      resource_type: 'image',
      bytes: 123,
    });
    expect(mocks.uploadAuth).toHaveBeenCalledWith(expect.anything(), expect.any(FormData), 'upload');
    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    const [forwardedUrl, forwardedInit] = mocks.fetchMock.mock.calls[0];
    expect(forwardedUrl.toString()).toBe('http://localhost/api/images');
    expect(forwardedInit.method).toBe('POST');
    const forwardedBody = forwardedInit.body;
    if (!(forwardedBody instanceof FormData)) throw new Error('Expected forwarded FormData');
    expect(forwardedBody.get('folder')).toBe('/v1');
    expect(forwardedBody.get('file')).toBeInstanceOf(File);
  });

  it('forwards video uploads to the canonical video route', async () => {
    const video = {
      id: 'vid-2',
      originalName: 'new.mp4',
      publicUrl: 'https://cdn.example/new.mp4',
      posterUrl: '/api/videos/vid-2/poster',
      width: 640,
      height: 360,
      duration: 3,
      fileSize: 456,
      format: 'mp4',
      mimeType: 'video/mp4',
      folder: '/v1-video',
      tags: '',
      createdAt: new Date('2026-05-01T00:00:00Z'),
    };
    mocks.fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      videos: [video],
      errors: [],
    }), { status: 201 }));

    const formData = new FormData();
    formData.set('file', new File(['video'], 'new.mp4', { type: 'video/mp4' }));
    formData.set('folder', '/v1-video');
    formData.set('resource_type', 'video');
    const response = await POST(request('/api/v1/media', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.resources[0]).toMatchObject({
      id: 'vid-2',
      resourceType: 'video',
      url: video.publicUrl,
      posterUrl: video.posterUrl,
      public_id: 'vid-2',
      secure_url: video.publicUrl,
      resource_type: 'video',
      created_at: '2026-05-01T00:00:00.000Z',
      bytes: 456,
    });
    const [forwardedUrl] = mocks.fetchMock.mock.calls[0];
    expect(forwardedUrl.toString()).toBe('http://localhost/api/videos');
    const forwardedBody = mocks.fetchMock.mock.calls[0][1].body;
    if (!(forwardedBody instanceof FormData)) throw new Error('Expected forwarded FormData');
    expect(forwardedBody.has('resource_type')).toBe(false);
  });

  it('rejects unsupported auto/raw upload resource types', async () => {
    for (const resourceType of ['auto', 'raw']) {
      const formData = new FormData();
      formData.set('file', new File(['asset'], 'asset.png', { type: 'image/png' }));
      formData.set('resource_type', resourceType);

      const response = await POST(request('/api/v1/media', { method: 'POST', body: formData }));
      expect(response.status).toBe(400);
      expect(mocks.fetchMock).not.toHaveBeenCalled();
    }
  });

  it('returns partial success when canonical uploads fail', async () => {
    mocks.fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        images: [],
        errors: [{ filename: 'bad.png', error: 'Unsupported format' }],
      }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        images: [{ id: 'img-3', publicUrl: 'https://cdn.example/good.png' }],
        errors: [],
      }), { status: 200 }));

    const formData = new FormData();
    formData.append('file', new File(['bad'], 'bad.png', { type: 'image/gif' }));
    formData.append('file', new File(['good'], 'good.png', { type: 'image/png' }));
    const response = await POST(request('/api/v1/media', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.success).toBe(false);
    expect(body.resources).toHaveLength(1);
    expect(body.errors).toEqual([{ filename: 'bad.png', error: 'Unsupported format' }]);
    expect(mocks.recordUsage).toHaveBeenCalledWith('key-1', 'upload', { errors: 1 });
  });

  describe('DELETE', () => {
    function deleteRequest(ids: unknown) {
      return DELETE(request('/api/v1/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }));
    }

    it('destroys mixed media and cleans video derivatives', async () => {
      mocks.imageFindMany.mockResolvedValue([{ id: 'img-1', storagePath: 'image.png' }]);
      mocks.videoFindMany.mockResolvedValue([{
        id: 'vid-1',
        storagePath: 'video.mp4',
        posterPath: 'poster.webp',
        renditions: [{ storagePath: 'rendition.mp4' }],
      }]);
      mocks.imageDeleteMany.mockResolvedValue({ count: 1 });
      mocks.videoDeleteMany.mockResolvedValue({ count: 1 });

      const response = await deleteRequest(['img-1', 'vid-1']);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mocks.bulkDeleteFromStorage).toHaveBeenCalledWith(['video.mp4', 'poster.webp', 'rendition.mp4']);
      expect(mocks.imageDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['img-1'] } } });
      expect(body.deleted).toBe(2);
      expect(body.resources).toEqual([
        { id: 'img-1', resourceType: 'image' },
        { id: 'vid-1', resourceType: 'video' },
      ]);
    });

    it('returns precise errors and retains records on storage failure', async () => {
      mocks.imageFindMany.mockResolvedValue([{ id: 'img-1', storagePath: 'image.png' }]);
      mocks.bulkDeleteFromStorage.mockRejectedValue(new Error('storage unavailable'));

      const response = await deleteRequest(['img-1', 'missing']);
      const body = await response.json();

      expect(response.status).toBe(207);
      expect(body.success).toBe(false);
      expect(body.errors).toEqual([
        { id: 'missing', error: 'Not found' },
        { id: 'img-1', error: 'Storage delete failed; database record retained' },
      ]);
      expect(mocks.imageDeleteMany).not.toHaveBeenCalled();
    });

    it('requires the explicit delete scope', async () => {
      mocks.deleteAuth.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks delete scope' });
      const response = await deleteRequest(['img-1']);
      expect(response.status).toBe(403);
      expect(mocks.bulkDeleteFromStorage).not.toHaveBeenCalled();
    });
  });
});
