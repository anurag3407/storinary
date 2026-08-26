// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { transformCache } from '@/lib/transform-cache';

const {
  findUniqueMock,
  namedTransformFindManyMock,
  getFromStorageMock,
  transformImageMock,
  diskCacheGetMock,
  diskCacheSetMock,
  recordVideoDeliveryMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  namedTransformFindManyMock: vi.fn(),
  getFromStorageMock: vi.fn(),
  transformImageMock: vi.fn(),
  diskCacheGetMock: vi.fn().mockResolvedValue(null),
  diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  recordVideoDeliveryMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findUnique: findUniqueMock },
    namedTransformation: { findMany: namedTransformFindManyMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
}));

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
}));

vi.mock('@/lib/disk-cache', () => ({
  diskCache: {
    get: diskCacheGetMock,
    set: diskCacheSetMock,
    clear: vi.fn().mockResolvedValue(undefined),
    size: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/lib/delivery-analytics', () => ({
  recordVideoDelivery: recordVideoDeliveryMock,
}));

const VIDEO = { posterPath: 'videos/posters/video-1.webp' };
const POSTER = { buffer: Buffer.from('poster'), contentType: 'image/webp' };
const TRANSFORMED = {
  buffer: Buffer.from('transformed'),
  contentType: 'image/jpeg',
  format: 'jpeg',
};
const context = { params: Promise.resolve({ id: 'video-1' }) };

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/videos/video-1/poster${query}`);
}

describe('GET /api/videos/:id/poster', () => {
  beforeEach(() => {
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.STORINARY_ADMIN_PASSWORD;
    findUniqueMock.mockReset().mockResolvedValue(VIDEO);
    namedTransformFindManyMock.mockReset().mockResolvedValue([]);
    getFromStorageMock.mockReset();
    transformImageMock.mockReset();
    diskCacheGetMock.mockClear().mockResolvedValue(null);
    diskCacheSetMock.mockClear();
    recordVideoDeliveryMock.mockClear();
    transformCache.clear();
  });
  it('returns 404 when the video or poster is missing', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect((await GET(makeRequest(), context)).status).toBe(404);

    findUniqueMock.mockResolvedValue({ posterPath: null });
    expect((await GET(makeRequest(), context)).status).toBe(404);
    expect(getFromStorageMock).not.toHaveBeenCalled();
  });

  it('serves the original poster and records analytics', async () => {
    getFromStorageMock.mockResolvedValue(POSTER);

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(await response.arrayBuffer()).toEqual(
      POSTER.buffer.buffer.slice(
        POSTER.buffer.byteOffset,
        POSTER.buffer.byteOffset + POSTER.buffer.byteLength
      )
    );
    expect(transformImageMock).not.toHaveBeenCalled();
    expect(recordVideoDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      videoId: 'video-1',
      referer: null,
      userAgent: null,
    }));
  });

  it('applies supported transformations', async () => {
    getFromStorageMock.mockResolvedValue(POSTER);
    transformImageMock.mockResolvedValue(TRANSFORMED);

    const response = await GET(makeRequest('?w=120&fmt=jpeg&q=70'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(transformImageMock).toHaveBeenCalledWith(POSTER.buffer, expect.objectContaining({
      w: 120,
      fmt: 'jpeg',
      q: 70,
    }));
    expect(recordVideoDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      videoId: 'video-1',
      label: 'poster-transform',
      bytes: TRANSFORMED.buffer.length,
    }));
  });

  it('reuses the in-memory transform cache', async () => {
    getFromStorageMock.mockResolvedValue(POSTER);
    transformImageMock.mockResolvedValue(TRANSFORMED);

    const first = await GET(makeRequest('?w=120'), context);
    const second = await GET(makeRequest('?w=120'), context);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledTimes(1);
    expect(getFromStorageMock).toHaveBeenCalledTimes(1);
  });

  it('promotes a disk-cached transform without re-processing', async () => {
    diskCacheGetMock.mockResolvedValue({
      buffer: Buffer.from('disk'),
      contentType: 'image/png',
    });

    const response = await GET(makeRequest('?w=120&fmt=png'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(transformCache.get('videos/posters/video-1.webp?w=120&fmt=png')).toEqual({
      buffer: Buffer.from('disk'),
      contentType: 'image/png',
    });
    expect(transformImageMock).not.toHaveBeenCalled();
  });

  it('returns 404 when transformed source storage is unavailable', async () => {
    getFromStorageMock.mockRejectedValue(new Error('missing'));

    const response = await GET(makeRequest('?w=120'), context);

    expect(response.status).toBe(404);
  });

  it('rejects invalid signed access before storage access', async () => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-secret';
    const response = await GET(makeRequest('?w=120&token=bad'), context);

    expect(response.status).toBe(403);
    expect(namedTransformFindManyMock).not.toHaveBeenCalled();
    expect(getFromStorageMock).not.toHaveBeenCalled();
  });
});
