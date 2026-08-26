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
  createHlsMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordUsageMock: vi.fn(),
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  getVideoMock: vi.fn(),
  publicUrlMock: vi.fn(),
  uploadMock: vi.fn(),
  ffmpegAvailableMock: vi.fn(),
  createHlsMock: vi.fn(),
}));

vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: authMock,
  recordManagementApiKeyUsage: recordUsageMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findUnique: findUniqueMock },
    videoHlsPackage: { upsert: upsertMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  getVideoFromStorage: getVideoMock,
  getPublicUrl: publicUrlMock,
  uploadToStorage: uploadMock,
}));

vi.mock('@/lib/video-renditions', () => ({
  HLS_VARIANT_PRESETS: {
    '360p': { width: 640, height: 360, bitrateKbps: 800, bandwidthKbps: 800 },
    '720p': { width: 1280, height: 720, bitrateKbps: 2500, bandwidthKbps: 2500 },
  },
  createVideoHlsPackage: createHlsMock,
  isFfmpegAvailable: ffmpegAvailableMock,
}));

const VIDEO = {
  id: 'video-1',
  storagePath: 'videos/source.mp4',
  renditions: [{ label: '720p', storagePath: 'videos/renditions/720p.mp4' }],
};

const generatedPackage = {
  masterManifest: 'videos/hls/video-1/stamp-master.m3u8',
  variantPlaylists: ['videos/hls/video-1/stamp-360p.m3u8', 'videos/hls/video-1/stamp-720p.m3u8'],
  segments: ['videos/hls/video-1/stamp-segment.ts'],
  totalFileSize: 100,
  variants: [
    { label: '360p', playlistPath: 'videos/hls/video-1/stamp-360p.m3u8', segmentPaths: ['videos/hls/video-1/stamp-segment.ts'], width: 640, height: 360, bandwidthKbps: 800 },
    { label: '720p', playlistPath: 'videos/hls/video-1/stamp-720p.m3u8', segmentPaths: ['videos/hls/video-1/stamp-segment.ts'], width: 1280, height: 720, bandwidthKbps: 2500 },
  ],
  files: [
    { path: 'videos/hls/video-1/stamp-master.m3u8', buffer: Buffer.from('master'), contentType: 'application/vnd.apple.mpegurl' },
    { path: 'videos/hls/video-1/stamp-360p.m3u8', buffer: Buffer.from('v360'), contentType: 'application/vnd.apple.mpegurl' },
    { path: 'videos/hls/video-1/stamp-720p.m3u8', buffer: Buffer.from('v720'), contentType: 'application/vnd.apple.mpegurl' },
    { path: 'videos/hls/video-1/stamp-segment.ts', buffer: Buffer.from('segment'), contentType: 'video/mp2t' },
  ],
};

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/videos/video-1/hls${query}`, {
    method: 'POST',
    headers: { 'x-api-key': 'stor_live_write' },
  });
}

describe('POST /api/videos/:id/hls', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'write-key' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    findUniqueMock.mockReset().mockResolvedValue(VIDEO);
    upsertMock.mockReset().mockImplementation(async ({ where }) => ({
      id: `hls-${where.videoId_label.label}`,
      ...where.videoId_label,
      masterPath: generatedPackage.masterManifest,
      publicUrl: 'https://cdn.example/master.m3u8',
      variants: generatedPackage.variants,
      segmentPaths: generatedPackage.segments,
      totalFileSize: generatedPackage.totalFileSize,
      status: 'ready',
    }));
    getVideoMock.mockReset().mockResolvedValue({ buffer: Buffer.from('source') });
    publicUrlMock.mockReset().mockReturnValue('https://cdn.example/master.m3u8');
    uploadMock.mockReset().mockResolvedValue(undefined);
    ffmpegAvailableMock.mockReset().mockResolvedValue(true);
    createHlsMock.mockReset().mockResolvedValue(generatedPackage);
  });

  it('generates and persists every explicit HLS file', async () => {
    const response = await POST(makeRequest('?variants=360p,720p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.hlsPackage.label).toBe('360p-720p');
    expect(uploadMock).toHaveBeenCalledTimes(generatedPackage.files.length);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ totalFileSize: 100 }),
    }));
    expect(recordUsageMock).toHaveBeenCalledWith('write-key', 'write', {
      assets: 1,
      bytes: 100,
    });
    expect(createHlsMock).toHaveBeenCalledWith(Buffer.from('source'), 'video-1', ['360p', '720p']);
  });

  it('rejects unsupported variants before FFmpeg or storage access', async () => {
    const response = await POST(makeRequest('?variants=1080p'), {
      params: Promise.resolve({ id: 'video-1' }),
    });

    expect(response.status).toBe(400);
    expect(getVideoMock).not.toHaveBeenCalled();
    expect(createHlsMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
