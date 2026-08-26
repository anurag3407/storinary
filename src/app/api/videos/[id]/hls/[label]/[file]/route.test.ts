// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const {
  findUniqueMock,
  getVideoMock,
  recordDeliveryMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  getVideoMock: vi.fn(),
  recordDeliveryMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { videoHlsPackage: { findUnique: findUniqueMock } },
}));

vi.mock('@/lib/storage', () => ({
  getVideoFromStorage: getVideoMock,
}));

vi.mock('@/lib/delivery-analytics', () => ({
  recordVideoDelivery: recordDeliveryMock,
}));

delete process.env.STORINARY_SIGNED_URL_SECRET;

const PACKAGE = {
  masterPath: 'videos/hls/video-1/stamp-master.m3u8',
  variants: [
    { label: '720p', playlistPath: 'videos/hls/video-1/stamp-720p.m3u8' },
  ],
  segmentPaths: ['videos/hls/video-1/stamp-segment-000.ts'],
};

function makeRequest(file: string) {
  return new NextRequest(`http://localhost/api/videos/video-1/hls/360p-720p/${file}`);
}

describe('GET /api/videos/:id/hls/:label/:file', () => {
  beforeEach(() => {
    findUniqueMock.mockReset().mockResolvedValue(PACKAGE);
    getVideoMock.mockReset().mockResolvedValue({ buffer: Buffer.from('asset'), contentType: 'application/octet-stream' });
    recordDeliveryMock.mockReset().mockResolvedValue(undefined);
  });

  it('serves master, playlist, and segment assets with correct types', async () => {
    for (const [file, type] of [
      ['stamp-master.m3u8', 'application/vnd.apple.mpegurl'],
      ['stamp-720p.m3u8', 'application/vnd.apple.mpegurl'],
      ['stamp-segment-000.ts', 'video/mp2t'],
    ] as const) {
      const response = await GET(makeRequest(file), {
        params: Promise.resolve({ id: 'video-1', label: '360p-720p', file }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(type);
    }
  });

  it('rejects unknown and unsafe assets without storage access', async () => {
    expect((await GET(makeRequest('../source'), {
      params: Promise.resolve({ id: 'video-1', label: '360p-720p', file: '../source' }),
    })).status).toBe(404);
    expect((await GET(makeRequest('missing.ts'), {
      params: Promise.resolve({ id: 'video-1', label: '360p-720p', file: 'missing.ts' }),
    })).status).toBe(404);
    expect(getVideoMock).not.toHaveBeenCalled();
  });
});
