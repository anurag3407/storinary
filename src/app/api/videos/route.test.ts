// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const {
  authMock,
  uploadPresetFindUniqueMock,
  readAuthMock,
  recordUsageMock,
  createMock,
  videoVersionCreateMock,
  findManyMock,
  countMock,
  metadataMock,
  posterMock,
  publicUrlMock,
  storageKeyMock,
  uploadMock,
  ffmpegAvailableMock,
  renditionCreateMock,
  framePosterMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadPresetFindUniqueMock: vi.fn(),
  readAuthMock: vi.fn(),
  recordUsageMock: vi.fn(),
  createMock: vi.fn(),
  videoVersionCreateMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  metadataMock: vi.fn(),
  posterMock: vi.fn(),
  publicUrlMock: vi.fn(),
  storageKeyMock: vi.fn(),
  uploadMock: vi.fn(),
  ffmpegAvailableMock: vi.fn(),
  renditionCreateMock: vi.fn(),
  framePosterMock: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({
  authorizeDashboardOrScopedUploadApiKey: authMock,
  authorizeDashboardOrReadApiKey: readAuthMock,
}));

vi.mock('@/lib/api-keys', () => ({ recordApiKeyUsage: recordUsageMock }));

const { dispatchWebhooksMock } = vi.hoisted(() => ({ dispatchWebhooksMock: vi.fn() }));

vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: dispatchWebhooksMock }));

vi.mock('@/lib/asset-versions', () => ({
  recordInitialVideoVersion: videoVersionCreateMock,
}));
vi.mock('@/lib/video-renditions', () => ({
  isFfmpegAvailable: ffmpegAvailableMock,
  createVideoFramePoster: framePosterMock,
  createVideoRendition: vi.fn(async () => ({
    buffer: Buffer.from('rendition'),
    width: 640,
    height: 360,
    bitrateKbps: 800,
  })),
  RENDITION_PRESETS: {
    '360p': { width: 640, height: 360, bitrateKbps: 800 },
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      create: createMock,
      findMany: findManyMock,
      count: countMock,
    },
    videoRendition: {
      create: renditionCreateMock,
    },
    uploadPreset: {
      findUnique: uploadPresetFindUniqueMock,
    },
    videoVersion: {
      create: videoVersionCreateMock,
    },
  },
}));
vi.mock('@/lib/image-processing', () => ({ createVideoPoster: posterMock }));
vi.mock('@/lib/video-metadata', () => ({ getVideoMetadata: metadataMock }));
vi.mock(
  '@/lib/storage',
  () => ({
    generateStorageKey: storageKeyMock,
    getPublicUrl: publicUrlMock,
    uploadToStorage: uploadMock,
  })
);

const VIDEO = {
  id: 'video-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('POST /api/videos', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'key' });
    uploadPresetFindUniqueMock.mockReset().mockResolvedValue(null);
    dispatchWebhooksMock.mockReset();
    videoVersionCreateMock.mockReset().mockResolvedValue({});
    metadataMock.mockReset().mockResolvedValue({ width: 0, height: 0, duration: 5, format: 'mp4' });
    posterMock.mockReset().mockResolvedValue({ buffer: Buffer.from('poster') });
    storageKeyMock.mockReset().mockReturnValue('2026/08/test-video-key.mp4');
    uploadMock.mockReset().mockResolvedValue(undefined);
    publicUrlMock.mockReset().mockReturnValue('https://cdn.example/video.mp4');
    framePosterMock.mockReset();
    createMock.mockReset().mockResolvedValue({ ...VIDEO });
    ffmpegAvailableMock.mockReset().mockResolvedValue(false);
    renditionCreateMock.mockReset().mockResolvedValue({});
  });

  it('rejects an image-only upload preset before authentication', async () => {
    uploadPresetFindUniqueMock.mockResolvedValue({
      active: true,
      resourceType: 'image',
      unsigned: false,
      folder: '/images',
      tags: '',
      renditions: false,
    });

    const formData = new FormData();
    formData.append('upload_preset', 'images_only');
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', {
      method: 'POST',
      headers: { 'x-api-key': 'stor_live_video' },
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors[0].error).toContain('not configured for videos');
    expect(authMock).not.toHaveBeenCalled();
  });

  it('enforces video preset policy and enables configured renditions', async () => {
    uploadPresetFindUniqueMock.mockResolvedValue({
      active: true,
      resourceType: 'video',
      unsigned: false,
      folder: '/preset/videos',
      tags: 'preset-video',
      renditions: true,
    });
    ffmpegAvailableMock.mockResolvedValue(true);
    createMock.mockResolvedValue({
      ...VIDEO,
      id: 'rendition-parent',
    });

    const formData = new FormData();
    formData.append('upload_preset', 'website_video');
    formData.append('folder', '/ignored');
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', {
      method: 'POST',
      headers: { 'x-api-key': 'stor_live_video' },
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(authMock).toHaveBeenCalledWith(expect.anything(), expect.any(FormData), 'video-upload', expect.objectContaining({ resourceType: 'video' }));
    expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ folder: '/preset/videos', tags: 'preset-video' }) });
    expect(renditionCreateMock).toHaveBeenCalledTimes(1);
    expect(storageKeyMock.mock.calls.some(([filename]) => String(filename).includes('-360p.mp4'))).toBe(true);
  });

  it('rejects signed video presets without credentials before file processing', async () => {
    uploadPresetFindUniqueMock.mockResolvedValue({
      active: true,
      resourceType: 'video',
      unsigned: false,
      folder: '/preset/videos',
      tags: '',
      renditions: false,
    });

    const formData = new FormData();
    formData.append('upload_preset', 'website_video_signed');
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: formData });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Signed video preset requires API credentials');
    expect(authMock).not.toHaveBeenCalled();
    expect(metadataMock).not.toHaveBeenCalled();
  });

  it('uploads a valid authenticated MP4', async () => {
    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', {
      method: 'POST',
      headers: { 'x-api-key': 'stor_live_test' },
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(uploadMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ format: 'mp4', duration: 5 }),
    });
    await vi.waitFor(() => {
      expect(recordUsageMock).toHaveBeenCalledWith('key', 'video-upload', {
        assets: 1,
        errors: 0,
        bytes: 5,
      });
    });
  });

  it('extracts a poster frame when no capture is supplied', async () => {
    ffmpegAvailableMock.mockResolvedValue(true);
    framePosterMock.mockResolvedValue(Buffer.from('extracted'));
    storageKeyMock.mockReturnValueOnce('2026/08/clip-key.mp4')
      .mockReturnValueOnce('2026/08/clip-key-poster.webp');

    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: formData });
    await POST(request);

    expect(framePosterMock).toHaveBeenCalledWith(Buffer.from('video'));
    expect(uploadMock).toHaveBeenNthCalledWith(2, Buffer.from('extracted'), '2026/08/clip-key-poster.webp', 'image/webp');
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ posterPath: '2026/08/clip-key-poster.webp' }),
    });
  });

  it('continues without a poster when extraction fails', async () => {
    ffmpegAvailableMock.mockResolvedValue(true);
    framePosterMock.mockRejectedValue(new Error('bad frame'));

    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: formData });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ posterPath: null }),
    });
  });

  it('rejects invalid credentials before reading files', async () => {
    authMock.mockResolvedValue({ ok: false, status: 401, error: 'Invalid or revoked API key' });
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: new FormData() });

    expect((await POST(request)).status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('uploads a re-encoded dashboard poster', async () => {
    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    formData.append(
      'poster-clip.mp4',
      new File(['capture'], 'clip.mp4.webp', { type: 'image/webp' })
    );
    storageKeyMock
      .mockReturnValueOnce('2026/08/clip-key.mp4')
      .mockReturnValueOnce('2026/08/clip-key-poster.webp');
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: formData });

    await POST(request);

    expect(posterMock).toHaveBeenCalledWith(Buffer.from('capture'));
    expect(uploadMock).toHaveBeenNthCalledWith(2, Buffer.from('poster'), '2026/08/clip-key-poster.webp', 'image/webp');
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ posterPath: '2026/08/clip-key-poster.webp' }),
    });
  });

  it('skips renditions when FFmpeg is unavailable', async () => {
    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    formData.append('renditions', 'true');

    const response = await POST(new NextRequest('http://localhost/api/videos', {
      method: 'POST',
      body: formData,
    }));

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/videos', () => {
  beforeEach(() => {
    readAuthMock.mockReset().mockResolvedValue({ ok: true, keyId: 'read-key' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    findManyMock.mockReset().mockResolvedValue([]);
    countMock.mockReset().mockResolvedValue(0);
  });

  it('passes search, folder, sorting, and pagination to Prisma', async () => {
    const request = new NextRequest(
      'http://localhost/api/videos?page=2&limit=12&search=drone&folder=/clips&sort=duration&order=asc'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [
          { originalName: { contains: 'drone' } },
          { tags: { contains: 'drone' } },
          { altText: { contains: 'drone' } },
        ],
        folder: '/clips',
      }),
      orderBy: { duration: 'asc' },
      skip: 12,
      take: 12,
      include: {
        renditions: true,
        metadata: { include: { field: { select: { externalId: true } } } },
      },
    });
    await expect(response.json()).resolves.toEqual({
      videos: [],
      pagination: { page: 2, limit: 12, total: 0, totalPages: 1 },
    });
    expect(readAuthMock).toHaveBeenCalledWith(request);
    expect(recordUsageMock).toHaveBeenCalledWith('read-key', 'read', expect.objectContaining({
      assets: 0,
    }));
  });

  it('rejects requests without dashboard or read-key authorization', async () => {
    readAuthMock.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks read scope' });

    const response = await GET(new NextRequest('http://localhost/api/videos'));

    expect(response.status).toBe(403);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it('falls back safely when query values are invalid or missing', async () => {
    const request = new NextRequest('http://localhost/api/videos?page=0&limit=999&sort=evil&order=weird');

    await GET(request);

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 100 }));
  });
});
