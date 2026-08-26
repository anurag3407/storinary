// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const {
  authMock,
  recordUsageMock,
  findUniqueMock,
  clipFindUniqueMock,
  clipCreateMock,
  getVideoMock,
  ffmpegAvailableMock,
  createClipMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordUsageMock: vi.fn(),
  findUniqueMock: vi.fn(),
  clipFindUniqueMock: vi.fn(),
  clipCreateMock: vi.fn(),
  getVideoMock: vi.fn(),
  ffmpegAvailableMock: vi.fn(),
  createClipMock: vi.fn(),
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: authMock,
  recordManagementApiKeyUsage: recordUsageMock,
}));

vi.mock('@/lib/webhooks', () => ({
  dispatchWebhooks: dispatchWebhookMock,
}));

const dispatchWebhookMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findUnique: findUniqueMock },
    videoClip: { findUnique: clipFindUniqueMock, create: clipCreateMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  getVideoFromStorage: getVideoMock,
  uploadToStorage: uploadMock,
  deleteFromStorage: deleteStorageMock,
  generateStorageKey: generateStorageKeyMock,
  getPublicUrl: getPublicUrlMock,
}));

const uploadMock = vi.hoisted(() => vi.fn());
const deleteStorageMock = vi.hoisted(() => vi.fn());
const generateStorageKeyMock = vi.hoisted(() => vi.fn());
const getPublicUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/video-renditions', () => ({
  MAX_VIDEO_CLIP_DURATION_SECONDS: 3600,
  createVideoClip: createClipMock,
  isFfmpegAvailable: ffmpegAvailableMock,
}));

const VIDEO = {
  id: 'video-1',
  originalName: 'Product Launch.mp4',
  storagePath: 'videos/source.mp4',
  duration: 30.5,
  renditions: [
    { id: 'r-720p', label: '720p', storagePath: 'videos/renditions/video-1720p.mp4' },
  ],
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/videos/video-1/clip', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'stor_live_write' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/videos/:id/clip', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'write-key' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    findUniqueMock.mockReset().mockResolvedValue(VIDEO);
    getVideoMock.mockReset().mockResolvedValue({ buffer: Buffer.from('source') });
    ffmpegAvailableMock.mockReset().mockResolvedValue(true);
    createClipMock.mockReset().mockResolvedValue(Buffer.from('clipped'));
    clipFindUniqueMock.mockReset().mockResolvedValue(null);
    clipCreateMock.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'clip-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    uploadMock.mockReset().mockResolvedValue('videos/clips/clip.mp4');
    deleteStorageMock.mockReset().mockResolvedValue(undefined);
    generateStorageKeyMock.mockReset().mockReturnValue('videos/clips/clip.mp4');
    getPublicUrlMock.mockReset().mockImplementation((key: string) => `https://cdn.example/${key}`);
    dispatchWebhookMock.mockReset().mockResolvedValue(undefined);
  });

  it('clips the requested range and returns an MP4 attachment', async () => {
    const response = await POST(makeRequest({ start: 2.5, end: 8 }), {
      params: Promise.resolve({ id: 'video-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('content-disposition')).toContain('Product-Launch-clip.mp4');
    expect(createClipMock).toHaveBeenCalledWith(Buffer.from('source'), 2.5, 8, {
      format: 'mp4',
      muted: false,
    });
    expect(recordUsageMock).toHaveBeenCalledWith('write-key', 'write', {
      assets: 1,
      bytes: 7,
    });
  });

  it('supports a duration relative to the start and a named rendition', async () => {
    await POST(makeRequest({ start: 1, duration: 4.5, rendition: '720p' }), {
      params: Promise.resolve({ id: 'video-1' }),
    });

    expect(getVideoMock).toHaveBeenCalledWith(VIDEO.renditions[0].storagePath);
    expect(createClipMock).toHaveBeenCalledWith(Buffer.from('source'), 1, 5.5, {
      format: 'mp4',
      muted: false,
    });
  });

  it('persists a named clip and returns its delivery record', async () => {
    const response = await POST(makeRequest({
      persist: true,
      name: 'intro',
      start: 2,
      duration: 4,
    }), { params: Promise.resolve({ id: 'video-1' }) });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ clip: { name: 'intro' } });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(clipCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'intro', muted: false }),
    }));
    expect(createClipMock).toHaveBeenCalledWith(Buffer.from('source'), 2, 6, {
      format: 'mp4',
      muted: false,
    });
  });

  it('rejects duplicate or invalid persistent clip names before processing', async () => {
    clipFindUniqueMock.mockResolvedValueOnce({ id: 'existing' });
    expect((await POST(makeRequest({ persist: true, name: 'intro', start: 0, duration: 1 }), {
      params: Promise.resolve({ id: 'video-1' }),
    })).status).toBe(409);
    expect((await POST(makeRequest({ persist: true, name: '', start: 0, duration: 1 }), {
      params: Promise.resolve({ id: 'video-1' }),
    })).status).toBe(400);
    expect(getVideoMock).not.toHaveBeenCalled();
  });

  it('validates timing and authorization before processing', async () => {
    expect((await POST(makeRequest({ start: 5, end: 5 }), {
      params: Promise.resolve({ id: 'video-1' }),
    })).status).toBe(400);
    expect((await POST(makeRequest({ start: 5, duration: 10_000 }), {
      params: Promise.resolve({ id: 'video-1' }),
    })).status).toBe(400);
    expect(createClipMock).not.toHaveBeenCalled();

    authMock.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks write scope' });
    expect((await POST(makeRequest({ start: 0, duration: 5 }), {
      params: Promise.resolve({ id: 'video-1' }),
    })).status).toBe(403);
  });
});
