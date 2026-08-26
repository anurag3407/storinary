// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, PATCH } from './route';
import { verifySignedUrlToken } from '@/lib/signed-delivery';

const {
  deleteStorageMock,
  findUniqueMock,
  videoDeleteMock,
  videoVersionCreateMock,
  videoVersionFindFirstMock,
} = vi.hoisted(() => ({
  deleteStorageMock: vi.fn(),
  findUniqueMock: vi.fn(),
  videoDeleteMock: vi.fn(),
  videoVersionCreateMock: vi.fn(),
  videoVersionFindFirstMock: vi.fn(),
}));

const {
  videoVersionFindManyMock,
  updateMock,
  structuredMetadataUpsertMock,
  structuredMetadataDeleteManyMock,
  metadataFieldFindFirstMock,
} = vi.hoisted(() => ({
  videoVersionFindManyMock: vi.fn(),
  updateMock: vi.fn(),
  structuredMetadataUpsertMock: vi.fn(),
  structuredMetadataDeleteManyMock: vi.fn(),
  metadataFieldFindFirstMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
      video: {
        findUnique: findUniqueMock,
        delete: videoDeleteMock,
        update: updateMock,
        versions: { findMany: videoVersionFindManyMock },
      },
      videoVersion: {
        create: videoVersionCreateMock,
        findFirst: videoVersionFindFirstMock,
      },
      metadataField: {
        findFirst: metadataFieldFindFirstMock,
      },
      structuredMetadata: {
        upsert: structuredMetadataUpsertMock,
        deleteMany: structuredMetadataDeleteManyMock,
      },
    },
}));

vi.mock('@/lib/storage', () => ({
  deleteFromStorage: deleteStorageMock,
}));

const { dispatchWebhooksMock } = vi.hoisted(() => ({ dispatchWebhooksMock: vi.fn() }));

vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: dispatchWebhooksMock }));

describe('DELETE /api/videos/[id]', () => {
  beforeEach(() => {
    deleteStorageMock.mockReset().mockResolvedValue(undefined);
    findUniqueMock.mockReset();
    videoDeleteMock.mockReset().mockResolvedValue({});
    videoVersionFindManyMock.mockReset().mockResolvedValue([]);
    videoVersionFindFirstMock.mockReset().mockResolvedValue({ version: 1 });
  });

  it('deletes database record and stored files', async () => {
    const posterPath = 'posters/clip.jpg';
    findUniqueMock.mockResolvedValue({
      id: 'video-1',
      storagePath: 'videos/clip.mp4',
      posterPath,
      renditions: [
        { id: 'r1', storagePath: 'videos/clip-360p.mp4' },
      ],
      versions: [],
      hlsPackages: [
        {
          masterPath: 'videos/hls/video-1/master.m3u8',
          variants: [{ playlistPath: 'videos/hls/video-1/720p.m3u8' }],
          segmentPaths: ['videos/hls/video-1/segment-000.ts'],
        },
      ],
      dashPackages: [
        {
          manifestPath: 'videos/dash/video-1/manifest.mpd',
          variants: [{ playlistPath: 'videos/dash/video-1/720p.mpd' }],
          filePaths: ['videos/dash/video-1/init.mp4'],
        },
      ],
      clips: [
        { id: 'clip-1', storagePath: 'videos/clips/video-1/intro.mp4' },
      ],
    });

    const request = new NextRequest('http://localhost/api/videos/video-1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'video-1' }) });

    await expect(response.json()).resolves.toEqual({ success: true, deleted: 'video-1' });
    expect(deleteStorageMock).toHaveBeenNthCalledWith(1, 'videos/clip.mp4');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(2, posterPath);
    expect(deleteStorageMock).toHaveBeenNthCalledWith(3, 'videos/clip-360p.mp4');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(4, 'videos/hls/video-1/master.m3u8');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(5, 'videos/hls/video-1/720p.m3u8');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(6, 'videos/hls/video-1/segment-000.ts');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(7, 'videos/dash/video-1/manifest.mpd');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(8, 'videos/dash/video-1/init.mp4');
    expect(deleteStorageMock).toHaveBeenNthCalledWith(9, 'videos/clips/video-1/intro.mp4');
    expect(videoDeleteMock).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      include: undefined,
    });
  });

  it('returns 404 for missing videos', async () => {
    findUniqueMock.mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/videos/missing', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'missing' }) });
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/videos/[id]', () => {
  beforeEach(() => {
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    process.env.STORINARY_ADMIN_PASSWORD = '';
    findUniqueMock.mockReset();
    updateMock.mockReset();
    metadataFieldFindFirstMock.mockReset();
    structuredMetadataUpsertMock.mockReset();
    structuredMetadataDeleteManyMock.mockReset().mockResolvedValue({ count: 0 });
    videoVersionFindManyMock.mockReset().mockResolvedValue([]);
    videoVersionFindFirstMock.mockReset().mockResolvedValue({ version: 1 });
    dispatchWebhooksMock.mockReset();
  });

  it('restores a historical version and archives the current file', async () => {
    process.env.STORINARY_ADMIN_PASSWORD = '';
    const historyRow = {
      id: 'history-1', videoId: 'video-1', version: 2, label: 'original',
      originalName: 'old.mp4', storagePath: 'videos/old.mp4',
      publicUrl: 'https://cdn.example/videos/old.mp4', mimeType: 'video/mp4',
      posterPath: null, format: 'mp4', width: 100, height: 100,
      duration: 3, fileSize: 30, createdAt: new Date(),
    };
    const current = {
      id: 'video-1', originalName: 'current.mp4', storagePath: 'videos/current.mp4',
      publicUrl: 'https://cdn.example/current.mp4', mimeType: 'video/mp4',
      posterPath: null, format: 'mp4', width: 200, height: 200,
      duration: 5, fileSize: 50,
      status: 'ready',
      folder: '/',
      tags: '',
      altText: '',
      renditions: [],
      hlsPackages: [],
      dashPackages: [],
      versions: [historyRow],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    findUniqueMock.mockResolvedValue(current);
    videoVersionCreateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'archive', createdAt: new Date(), ...data })
    );
    updateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...current, ...data })
    );

    const request = new NextRequest('http://localhost/api/videos/video-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreVersionId: 'history-1' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(videoVersionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storagePath: 'videos/current.mp4',
        label: 'replaced',
        version: 2,
      }),
    });
    expect(body.originalName).toBe('old.mp4');
    expect(deleteStorageMock).not.toHaveBeenCalled();
    expect(dispatchWebhooksMock).toHaveBeenCalledWith(
      'video.updated',
      expect.objectContaining({ action: 'restored' })
    );
  });

  it('returns signed stream and poster links when private delivery is enabled', async () => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://media.example';
    const updatedVideo = {
      id: 'video-1',
      originalName: 'clip.mp4',
      storagePath: 'videos/clip.mp4',
      publicUrl: 'https://cdn.example/clip.mp4',
      mimeType: 'video/mp4',
      posterPath: 'videos/clip-poster.webp',
      format: 'mp4',
      width: 1920,
      height: 1080,
      duration: 10,
      fileSize: 1234,
      folder: '/videos',
      tags: '',
      altText: '',
      status: 'ready',
      renditions: [{ id: 'r1', label: '720p' }],
      hlsPackages: [],
      dashPackages: [],
      versions: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    updateMock.mockResolvedValue(updatedVideo);

    const request = new NextRequest('https://app.example/api/videos/video-1?ttl=60', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'updated' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tags).toBe('');
    expect(body.links.renditionUrls['720p']).toMatch(/^https:\/\/media\.example\/api\/videos\/video-1\/stream\?/);

    const stream = new URL(body.links.streamUrl);
    const poster = new URL(body.links.posterUrl);
    const rendition = new URL(body.links.renditionUrls['720p']);
    expect(stream.pathname).toBe('/api/videos/video-1/stream');
    expect(poster.pathname).toBe('/api/videos/video-1/poster');
    expect(rendition.searchParams.get('rendition')).toBe('720p');
    expect(verifySignedUrlToken('/api/videos/video-1/stream', stream.searchParams.get('token'))).toBe(true);
    expect(verifySignedUrlToken('/api/videos/video-1/poster', poster.searchParams.get('token'))).toBe(true);
  });

  it('updates and serializes structured metadata for a video', async () => {
    const updatedVideo = {
      id: 'video-1',
      originalName: 'clip.mp4',
      storagePath: 'videos/clip.mp4',
      publicUrl: 'https://cdn.example/clip.mp4',
      mimeType: 'video/mp4',
      posterPath: null,
      format: 'mp4',
      width: 1920,
      height: 1080,
      duration: 10,
      fileSize: 1234,
      folder: '/videos',
      tags: '',
      altText: '',
      status: 'ready',
      aiModerated: false,
      aiModerationScore: null,
      renditions: [],
      hlsPackages: [],
      dashPackages: [],
      versions: [],
      metadata: [{ field: { externalId: 'campaign' }, value: 'spring' }],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    updateMock.mockResolvedValue(updatedVideo);
    structuredMetadataUpsertMock.mockResolvedValue({});
    metadataFieldFindFirstMock.mockResolvedValue({
      id: 'field-campaign',
      externalId: 'campaign',
      type: 'enum',
      required: false,
      allowedValues: 'spring|fall',
    });

    const request = new NextRequest('http://localhost/api/videos/video-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { campaign: 'spring' } }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(metadataFieldFindFirstMock).toHaveBeenCalledWith({
      where: { externalId: 'campaign', active: true },
    });
    expect(structuredMetadataUpsertMock).toHaveBeenCalledWith({
      where: { fieldId_videoId: { fieldId: 'field-campaign', videoId: 'video-1' } },
      create: { fieldId: 'field-campaign', value: 'spring', videoId: 'video-1' },
      update: { value: 'spring' },
    });
    expect(body.metadata).toEqual({ campaign: 'spring' });
  });

  it('deletes cleared video metadata instead of storing an empty value', async () => {
    updateMock.mockResolvedValue({
      id: 'video-1',
      originalName: 'clip.mp4',
      storagePath: 'videos/clip.mp4',
      publicUrl: 'https://cdn.example/clip.mp4',
      mimeType: 'video/mp4',
      posterPath: null,
      format: 'mp4',
      width: 1920,
      height: 1080,
      duration: 10,
      fileSize: 1234,
      folder: '/videos',
      tags: '',
      altText: '',
      status: 'ready',
      aiModerated: false,
      aiModerationScore: null,
      renditions: [],
      hlsPackages: [],
      dashPackages: [],
      versions: [],
      metadata: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    metadataFieldFindFirstMock.mockResolvedValue({
      id: 'field-campaign',
      externalId: 'campaign',
      type: 'enum',
      required: false,
      allowedValues: 'spring|fall',
    });

    const request = new NextRequest('http://localhost/api/videos/video-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { campaign: '' } }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(structuredMetadataDeleteManyMock).toHaveBeenCalledWith({
      where: { fieldId: 'field-campaign', videoId: 'video-1' },
    });
    expect(structuredMetadataUpsertMock).not.toHaveBeenCalled();
    expect(body.metadata).toEqual({});
  });

  it('rejects unknown video metadata fields', async () => {
    updateMock.mockResolvedValue({});
    metadataFieldFindFirstMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/videos/video-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { missing: 'x' } }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unknown or inactive metadata field');
    expect(updateMock).not.toHaveBeenCalled();
  });
});
