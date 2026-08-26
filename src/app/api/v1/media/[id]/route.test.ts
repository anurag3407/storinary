// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from './route';

const mocks = vi.hoisted(() => ({
  readAuth: vi.fn(),
  deleteAuth: vi.fn(),
  writeAuth: vi.fn(),
  recordUsage: vi.fn(),
  imageFindUnique: vi.fn(),
  imageDelete: vi.fn(),
  imageUpdate: vi.fn(),
  imageVersionFindMany: vi.fn(),
  videoFindUnique: vi.fn(),
  videoDelete: vi.fn(),
  videoUpdate: vi.fn(),
  videoVersionFindMany: vi.fn(),
  imageVersionFindFirst: vi.fn(),
  videoVersionFindFirst: vi.fn(),
  imageVersionCreate: vi.fn(),
  videoVersionCreate: vi.fn(),
  metadataFieldFindMany: vi.fn(),
  structuredMetadataUpsert: vi.fn(),
  structuredMetadataDeleteMany: vi.fn(),
  deleteFromStorage: vi.fn(),
  dispatchWebhooks: vi.fn(),
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrReadApiKey: mocks.readAuth,
  authorizeDashboardOrDeleteApiKey: mocks.deleteAuth,
  authorizeDashboardOrWriteApiKey: mocks.writeAuth,
}));
vi.mock('@/lib/api-keys', () => ({ recordApiKeyUsage: mocks.recordUsage }));
vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: mocks.dispatchWebhooks }));
vi.mock('@/lib/storage', () => ({ deleteFromStorage: mocks.deleteFromStorage }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: {
      findUnique: mocks.imageFindUnique,
      delete: mocks.imageDelete,
      update: mocks.imageUpdate,
    },
    video: {
      findUnique: mocks.videoFindUnique,
      delete: mocks.videoDelete,
      update: mocks.videoUpdate,
    },
    imageVersion: {
      findMany: mocks.imageVersionFindMany,
      findFirst: mocks.imageVersionFindFirst,
      create: mocks.imageVersionCreate,
    },
    videoVersion: {
      findMany: mocks.videoVersionFindMany,
      findFirst: mocks.videoVersionFindFirst,
      create: mocks.videoVersionCreate,
    },
    metadataField: { findMany: mocks.metadataFieldFindMany },
    structuredMetadata: {
      upsert: mocks.structuredMetadataUpsert,
      deleteMany: mocks.structuredMetadataDeleteMany,
    },
  },
}));

function request(
  url = '/api/v1/media/resource-1',
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(`http://localhost${url}`, init);
}

function context() {
  return { params: Promise.resolve({ id: 'resource-1' }) };
}

beforeEach(() => {
  mocks.readAuth.mockReset().mockResolvedValue({ ok: true, keyId: null });
  mocks.deleteAuth.mockReset().mockResolvedValue({ ok: true, keyId: null });
  mocks.writeAuth.mockReset().mockResolvedValue({ ok: true, keyId: null });
  mocks.recordUsage.mockReset().mockResolvedValue(undefined);
  mocks.imageFindUnique.mockReset().mockResolvedValue(null);
  mocks.imageVersionFindMany.mockReset().mockResolvedValue([]);
  mocks.imageDelete.mockReset().mockResolvedValue({});
  mocks.imageUpdate.mockReset();
  mocks.videoFindUnique.mockReset().mockResolvedValue(null);
  mocks.videoVersionFindMany.mockReset().mockResolvedValue([]);
  mocks.imageVersionFindFirst.mockReset().mockResolvedValue({ version: 2 });
  mocks.videoVersionFindFirst.mockReset().mockResolvedValue({ version: 3 });
  mocks.imageVersionCreate.mockReset().mockImplementation(({ data }) =>
    Promise.resolve({ id: `archive-image-${data.version}`, createdAt: new Date(), ...data })
  );
  mocks.videoVersionCreate.mockReset().mockImplementation(({ data }) =>
    Promise.resolve({ id: `archive-video-${data.version}`, createdAt: new Date(), ...data })
  );
  mocks.videoDelete.mockReset().mockResolvedValue({});
  mocks.videoUpdate.mockReset();
  mocks.metadataFieldFindMany.mockReset().mockResolvedValue([]);
  mocks.structuredMetadataUpsert.mockReset().mockResolvedValue({});
  mocks.structuredMetadataDeleteMany.mockReset().mockResolvedValue({ count: 0 });
  mocks.deleteFromStorage.mockReset().mockResolvedValue(undefined);
  mocks.dispatchWebhooks.mockReset();
});

describe('/api/v1/media/:id', () => {
  it('returns a keyed image resource', async () => {
    mocks.readAuth.mockResolvedValue({ ok: true, keyId: 'read-key' });
    mocks.imageFindUnique.mockResolvedValue({
      id: 'resource-1',
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
      collections: [{ collection: { id: 'collection-1', name: 'Launch' } }],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const response = await GET(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({
      id: 'resource-1',
      resourceType: 'image',
      publicId: '/site/hero-id',
      public_id: '/site/hero-id',
      secure_url: 'https://cdn.example/hero.png',
      bytes: 30,
      collections: [{ id: 'collection-1', name: 'Launch' }],
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith('read-key', 'read', { assets: 1 });
  });

  it('returns a video resource with normalized collections', async () => {
    mocks.videoFindUnique.mockResolvedValue({
      id: 'resource-1',
      originalName: 'clip.mp4',
      storagePath: 'video.mp4',
      publicUrl: 'https://cdn.example/video.mp4',
      posterPath: null,
      mimeType: 'video/mp4',
      format: 'mp4',
      width: 100,
      height: 100,
      duration: 2,
      fileSize: 30,
      folder: '/site',
      tags: 'hero,new',
      altText: '',
      status: 'ready',
      renditions: [],
      versions: [],
      collections: [{ collection: { id: 'collection-1', name: 'Launch' } }],
      metadata: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const response = await GET(request('?resource_type=video'), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({
      id: 'resource-1',
      resourceType: 'video',
      collections: [{ id: 'collection-1', name: 'Launch' }],
    });
  });

  it('requires read authorization before database lookup', async () => {
    mocks.readAuth.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks read scope' });
    const response = await GET(request('?resource_type=video'), context());
    expect(response.status).toBe(403);
    expect(mocks.imageFindUnique).not.toHaveBeenCalled();
  });

  it('deletes an image with the scoped destroy credential', async () => {
    mocks.imageFindUnique.mockResolvedValue({
      id: 'resource-1',
      originalName: 'hero.png',
      storagePath: '/site/hero-id.png',
      publicUrl: 'https://cdn.example/hero.png',
      width: 10, height: 20, fileSize: 30, format: 'png',
      mimeType: 'image/png', folder: '/site', tags: 'hero,new',
      createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const response = await DELETE(request('', { method: 'DELETE' }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      deleted: [{ id: 'resource-1', resourceType: 'image' }],
      public_id: 'resource-1',
    });
    expect(mocks.deleteFromStorage).toHaveBeenCalledWith('/site/hero-id.png');
    expect(mocks.imageDelete).toHaveBeenCalledWith({ where: { id: 'resource-1' } });
  });

  it('deletes all video derivatives before the database record', async () => {
    mocks.videoFindUnique.mockResolvedValue({
      id: 'resource-1', originalName: 'clip.mp4', storagePath: 'video.mp4',
      publicUrl: 'https://cdn.example/video.mp4', mimeType: 'video/mp4',
      posterPath: 'poster.webp', format: 'mp4', width: 100, height: 100,
      duration: 2, fileSize: 10, folder: '/', tags: '', altText: '',
      status: 'ready', createdAt: new Date(), updatedAt: new Date(),
      renditions: [{ storagePath: 'rendition.mp4' }],
      versions: [],
      clips: [{ storagePath: 'named-clip.mp4' }],
    });
    const response = await DELETE(request('?resource_type=video', { method: 'DELETE' }), context());

    expect(response.status).toBe(200);
    expect(mocks.deleteFromStorage.mock.calls.map(([path]) => path)).toEqual([
      'video.mp4', 'poster.webp', 'rendition.mp4', 'named-clip.mp4',
    ]);
    expect(mocks.videoDelete).toHaveBeenCalled();
  });

  it('rejects credentials without delete scope for deletion', async () => {
    mocks.deleteAuth.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks delete scope' });
    const response = await DELETE(request('', { method: 'DELETE' }), context());
    expect(response.status).toBe(403);
    expect(mocks.imageFindUnique).not.toHaveBeenCalled();
    expect(mocks.imageDelete).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/media/:id', () => {
  it('updates image metadata with a scoped write key', async () => {
    mocks.writeAuth.mockResolvedValue({ ok: true, keyId: 'write-key' });
    mocks.imageUpdate.mockResolvedValue({
      id: 'resource-1',
      originalName: 'hero.png',
      storagePath: '/site/hero-id.png',
      publicUrl: 'https://cdn.example/hero.png',
      width: 10,
      height: 20,
      fileSize: 30,
      format: 'png',
      mimeType: 'image/png',
      folder: '/new-folder',
      tags: 'updated',
      altText: 'Updated alt text',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });

    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: 'updated',
        altText: 'Updated alt text',
        folder: '/new-folder',
      }),
    }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({ id: 'resource-1', tags: ['updated'] });
    expect(mocks.recordUsage).toHaveBeenCalledWith('write-key', 'write', { assets: 1 });
  });

  it('updates video metadata and emits the update event', async () => {
    mocks.videoUpdate.mockResolvedValue({
      id: 'resource-1',
      originalName: 'clip.mp4',
      storagePath: 'video.mp4',
      publicUrl: 'https://cdn.example/video.mp4',
      mimeType: 'video/mp4',
      posterPath: null,
      format: 'mp4',
      width: 100,
      height: 100,
      duration: 2,
      fileSize: 10,
      folder: '/videos',
      tags: 'updated-video',
      altText: '',
      status: 'ready',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      renditions: [],
    });

    const response = await PATCH(request('?resource_type=video', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'updated-video' }),
    }), context());

    expect(response.status).toBe(200);
    expect(mocks.dispatchWebhooks).toHaveBeenCalledWith(
      'video.updated',
      expect.objectContaining({ id: 'resource-1' })
    );
  });

  it('rejects write attempts without the write scope', async () => {
    mocks.writeAuth.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks write scope' });
    const response = await PATCH(request('', { method: 'PATCH' }), context());
    expect(response.status).toBe(403);
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH structured metadata /api/v1/media/:id', () => {
  beforeEach(() => {
    mocks.metadataFieldFindMany.mockResolvedValue([{
      id: 'field-1',
      externalId: 'campaign',
      type: 'enum',
      required: false,
      allowedValues: 'spring|fall',
    }]);
    mocks.imageUpdate.mockResolvedValue({
      id: 'resource-1',
      originalName: 'hero.png',
      storagePath: '/site/hero-id.png',
      publicUrl: 'https://cdn.example/hero.png',
      width: 10,
      height: 20,
      fileSize: 30,
      format: 'png',
      mimeType: 'image/png',
      folder: '/site',
      tags: '',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      metadata: [{ field: { externalId: 'campaign' }, value: 'fall' }],
    });
  });

  it('upserts only active defined fields and returns the object', async () => {
    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { campaign: 'fall' } }),
    }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.structuredMetadataUpsert).toHaveBeenCalledWith({
      where: { fieldId_imageId: { fieldId: 'field-1', imageId: 'resource-1' } },
      create: { fieldId: 'field-1', value: 'fall', imageId: 'resource-1' },
      update: { value: 'fall' },
    });
    expect(body.resources[0].metadata).toEqual({ campaign: 'fall' });
  });

  it('deletes cleared image metadata instead of storing an empty value', async () => {
    mocks.imageUpdate.mockResolvedValue({
      id: 'resource-1',
      originalName: 'hero.png',
      storagePath: '/site/hero-id.png',
      publicUrl: 'https://cdn.example/hero.png',
      width: 10,
      height: 20,
      fileSize: 30,
      format: 'png',
      mimeType: 'image/png',
      folder: '/',
      tags: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: [],
    });

    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { campaign: '' } }),
    }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.structuredMetadataDeleteMany).toHaveBeenCalledWith({
      where: { fieldId: 'field-1', imageId: 'resource-1' },
    });
    expect(mocks.structuredMetadataUpsert).not.toHaveBeenCalled();
    expect(body.resources[0].metadata).toEqual({});
  });

  it('rejects unknown fields before updating the asset', async () => {
    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { missing: 'value' } }),
    }), context());

    expect(response.status).toBe(400);
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH version restore /api/v1/media/:id', () => {
  const restoredAt = new Date('2026-01-03T00:00:00Z');

  function restoredImage() {
    return {
      id: 'resource-1',
      originalName: 'old.png',
      storagePath: '/site/hero-id.png',
      publicUrl: 'https://cdn.example/hero.png',
      width: 10,
      height: 20,
      fileSize: 30,
      format: 'png',
      mimeType: 'image/png',
      folder: '/site',
      tags: '',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  beforeEach(() => {
    mocks.dispatchWebhooks.mockReset();
  });

  it('restores an image version and archives the current asset', async () => {
    mocks.imageFindUnique.mockResolvedValue({
      ...restoredImage(),
      versions: [{
        id: 'version-1', version: 1, label: 'original',
        originalName: 'old.png', storagePath: '/site/old-id.png',
        publicUrl: 'https://cdn.example/old.png', width: 10, height: 20,
        fileSize: 30, format: 'png', mimeType: 'image/png',
        imageId: 'resource-1', createdAt: restoredAt,
      }],
      metadata: [],
    });
    mocks.imageUpdate.mockResolvedValue(restoredImage());

    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreVersionId: 'version-1' }),
    }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resources[0]).toMatchObject({
      id: 'resource-1',
      originalName: 'old.png',
      resource_type: 'image',
    });
    expect(mocks.imageUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchWebhooks).toHaveBeenCalledWith(
      'image.updated',
      expect.objectContaining({ id: 'resource-1', action: 'restored' })
    );
  });

  it('restores a video version through resource_type=video', async () => {
    const current = {
      id: 'resource-1',
      originalName: 'new.mp4',
      storagePath: 'video.mp4',
      publicUrl: 'https://cdn.example/video.mp4',
      mimeType: 'video/mp4',
      posterPath: null,
      format: 'mp4',
      width: 100,
      height: 100,
      duration: 2,
      fileSize: 10,
      folder: '/videos',
      tags: '',
      altText: '',
      status: 'ready',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: restoredAt,
      renditions: [],
      versions: [{
        id: 'version-1', version: 1, label: 'original', videoId: 'resource-1',
        originalName: 'old.mp4', storagePath: 'old.mp4',
        publicUrl: 'https://cdn.example/old.mp4', posterPath: null,
        width: 100, height: 100, duration: 2, fileSize: 10,
        format: 'mp4', mimeType: 'video/mp4', createdAt: restoredAt,
      }],
    };
    mocks.videoFindUnique.mockResolvedValue(current);
    mocks.videoUpdate.mockResolvedValue({ ...current, originalName: 'old.mp4' });

    const response = await PATCH(request('?resource_type=video', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreVersionId: 'version-1' }),
    }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.restoredVersion.version).toBeGreaterThan(1);
    expect(body.resources[0]).toMatchObject({
      id: 'resource-1',
      originalName: 'old.mp4',
      resource_type: 'video',
    });
    expect(mocks.videoUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchWebhooks).toHaveBeenCalledWith(
      'video.updated',
      expect.objectContaining({ id: 'resource-1', action: 'restored' })
    );
  });

  it('returns 404 for an unknown restore version', async () => {
    mocks.imageFindUnique.mockResolvedValue({
      ...restoredImage(),
      versions: [],
    });

    const response = await PATCH(request('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreVersionId: 'missing' }),
    }), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Version not found' });
  });
});
