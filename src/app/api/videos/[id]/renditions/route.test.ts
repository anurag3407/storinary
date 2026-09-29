// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const {
  authMock,
  recordUsageMock,
  findUniqueMock,
  upsertMock,
  getVideoMock,
  publicUrlMock,
  uploadMock,
  ffmpegAvailableMock,
  createRenditionMock,
  quotaCheckMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordUsageMock: vi.fn(),
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  getVideoMock: vi.fn(),
  publicUrlMock: vi.fn(),
  uploadMock: vi.fn(),
  ffmpegAvailableMock: vi.fn(),
  createRenditionMock: vi.fn(),
  quotaCheckMock: vi.fn(),
}));

vi.mock('@/lib/quota', () => ({
  checkStorageQuota: quotaCheckMock,
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: authMock,
  recordManagementApiKeyUsage: recordUsageMock,
}));

vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org-1', slug: 'acme' }) },
    video: { findUnique: findUniqueMock },
    videoRendition: { upsert: upsertMock },
  };
  return { prisma: scoped, rawPrisma: scoped };
})

vi.mock('@/lib/storage', () => ({
  getVideoFromStorage: getVideoMock,
  getPublicUrl: publicUrlMock,
  uploadToStorage: uploadMock,
}));

vi.mock('@/lib/video-renditions', () => ({
  RENDITION_PRESETS: {
    '360p': { width: 640, height: 360, bitrateKbps: 800 },
    '720p': { width: 1280, height: 720, bitrateKbps: 2500 },
  },
  createVideoRendition: createRenditionMock,
  isFfmpegAvailable: ffmpegAvailableMock,
}));

const VIDEO = { id: 'video-1', storagePath: 'videos/source.mp4', renditions: [] };

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/videos/video-1/renditions${query}`, {
    method: 'POST',
    headers: { 'x-api-key': 'stor_live_write' },
  });
}

describe('POST /api/videos/:id/renditions', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'write-key', organizationId: 'org-1' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    findUniqueMock.mockReset().mockResolvedValue(VIDEO);
    upsertMock.mockReset();
    getVideoMock.mockReset().mockResolvedValue({ buffer: Buffer.from('source') });
    publicUrlMock.mockReset().mockReturnValue('https://cdn.example/rendition.mp4');
    uploadMock.mockReset().mockResolvedValue(undefined);
    ffmpegAvailableMock.mockReset().mockResolvedValue(true);
    createRenditionMock.mockReset();
    quotaCheckMock.mockReset().mockResolvedValue({ allowed: true });
  });

  it('generates both default renditions', async () => {
    createRenditionMock.mockImplementation(async (_buffer, label) => ({
      buffer: Buffer.from(label),
      width: label === '360p' ? 640 : 1280,
      height: label === '360p' ? 360 : 720,
      bitrateKbps: label === '360p' ? 800 : 2500,
    }));
    upsertMock.mockImplementation(async ({ where }) => ({
      id: `r-${where.videoId_label.label}`,
      ...where.videoId_label,
      status: 'ready',
    }));

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'video-1' }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.created).toBe(2);
    expect(createRenditionMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(recordUsageMock).toHaveBeenCalledWith('write-key', 'write', expect.objectContaining({
      assets: 1,
    }));
  });

  it('rejects unsupported labels before storage access', async () => {
    const response = await POST(makeRequest('?labels=1080p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });

    expect(response.status).toBe(400);
    expect(getVideoMock).not.toHaveBeenCalled();
  });

  it('returns partial success when one rendition fails', async () => {
    createRenditionMock
      .mockRejectedValueOnce(new Error('encoder failed'))
      .mockResolvedValueOnce({
        buffer: Buffer.from('720'),
        width: 1280,
        height: 720,
        bitrateKbps: 2500,
      });
    upsertMock.mockResolvedValue({ id: 'r-720p', label: '720p' });

    const response = await POST(makeRequest('?labels=360p,720p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.success).toBe(false);
    expect(body.errors).toEqual([{ label: '360p', error: 'encoder failed' }]);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).toHaveBeenCalledWith('write-key', 'write', { errors: 1 });
  });

  it('requires write authorization and FFmpeg availability', async () => {
    authMock.mockResolvedValue({ ok: false, status: 403, error: 'API key lacks write scope' });
    expect((await POST(makeRequest(), { params: Promise.resolve({ id: 'video-1' }) })).status).toBe(403);

    authMock.mockResolvedValue({ ok: true, keyId: null, organizationId: 'org-1' });
    ffmpegAvailableMock.mockResolvedValue(false);
    expect((await POST(makeRequest(), { params: Promise.resolve({ id: 'video-1' }) })).status).toBe(503);
    expect(getVideoMock).not.toHaveBeenCalled();
  });

  it('rejects rendition generation with 403 when storage quota is exceeded', async () => {
    quotaCheckMock.mockResolvedValue({
      allowed: false,
      error: 'Storage quota exceeded (100 MB free tier limit)',
    });
    createRenditionMock.mockResolvedValue({
      buffer: Buffer.from('large-video-rendition'),
      width: 1280,
      height: 720,
      bitrateKbps: 2500,
    });

    const response = await POST(makeRequest('?labels=720p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.quotaExceeded).toBe(true);
    expect(body.errors[0].error).toContain('Storage quota exceeded');
    expect(uploadMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
