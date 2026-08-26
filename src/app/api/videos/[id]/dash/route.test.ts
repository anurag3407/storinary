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
  uploadMock,
  ffmpegAvailableMock,
  createDashMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordUsageMock: vi.fn(),
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  getVideoMock: vi.fn(),
  uploadMock: vi.fn(),
  ffmpegAvailableMock: vi.fn(),
  createDashMock: vi.fn(),
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: authMock,
  recordManagementApiKeyUsage: recordUsageMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findUnique: findUniqueMock },
    videoDashPackage: { upsert: upsertMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  getVideoFromStorage: getVideoMock,
  getPublicUrl: vi.fn().mockReturnValue('https://cdn.example/manifest.mpd'),
  uploadToStorage: uploadMock,
}));

vi.mock('@/lib/video-renditions', () => ({
  HLS_VARIANT_PRESETS: {
    '360p': { width: 640, height: 360, bitrateKbps: 800, bandwidthKbps: 800 },
    '720p': { width: 1280, height: 720, bitrateKbps: 2500, bandwidthKbps: 2500 },
  },
  createVideoDashPackage: createDashMock,
  isFfmpegAvailable: ffmpegAvailableMock,
}));

const VIDEO = {
  id: 'video-1',
  storagePath: 'videos/source.mp4',
  renditions: [],
};

const generated = {
  manifestPath: 'videos/dash/video-1/stamp-360p.mpd',
  filePaths: ['videos/dash/video-1/stamp-360p.mpd', 'videos/dash/video-1/stamp-360p-init.mp4'],
  totalFileSize: 100,
  variants: [
    { label: '360p', playlistPath: 'videos/dash/video-1/stamp-360p.mpd', initPath: 'videos/dash/video-1/stamp-360p-init.mp4', mediaSegmentPaths: [], width: 640, height: 360, bandwidthKbps: 800 },
  ],
  files: [
    { path: 'videos/dash/video-1/stamp-360p.mpd', buffer: Buffer.from('manifest'), contentType: 'application/dash+xml' },
    { path: 'videos/dash/video-1/stamp-360p-init.mp4', buffer: Buffer.from('segment'), contentType: 'video/mp4' },
  ],
};

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/videos/video-1/dash${query}`, {
    method: 'POST',
    headers: { 'x-api-key': 'stor_live_write' },
  });
}

describe('POST /api/videos/:id/dash', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'write-key' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    findUniqueMock.mockReset().mockResolvedValue(VIDEO);
    upsertMock.mockReset().mockResolvedValue({ id: 'dash-1', label: '360p' });
    getVideoMock.mockReset().mockResolvedValue({ buffer: Buffer.from('source') });
    uploadMock.mockReset().mockResolvedValue(undefined);
    ffmpegAvailableMock.mockReset().mockResolvedValue(true);
    createDashMock.mockReset().mockResolvedValue(generated);
  });

  it('generates and persists every DASH file', async () => {
    const response = await POST(makeRequest('?variants=360p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.dashPackage.label).toBe('360p');
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(createDashMock).toHaveBeenCalledWith(Buffer.from('source'), 'video-1', ['360p']);
    expect(recordUsageMock).toHaveBeenCalledWith('write-key', 'write', { assets: 1, bytes: 100 });
  });

  it('rejects unsupported variants before storage or FFmpeg access', async () => {
    const response = await POST(makeRequest('?variants=1080p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });

    expect(response.status).toBe(400);
    expect(getVideoMock).not.toHaveBeenCalled();
    expect(createDashMock).not.toHaveBeenCalled();
  });
});
