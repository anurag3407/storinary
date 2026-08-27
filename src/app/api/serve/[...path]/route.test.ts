// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { transformCache } from '@/lib/transform-cache';
import { createSignedUrlToken } from '@/lib/signed-delivery';

const { getFromStorageMock, getPublicUrlMock, transformImageMock, diskCacheGetMock, diskCacheSetMock } =
  vi.hoisted(() => ({
    getFromStorageMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    transformImageMock: vi.fn(),
    diskCacheGetMock: vi.fn().mockResolvedValue(null),
    diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
  getPublicUrl: getPublicUrlMock,
}));

const { namedTransformFindManyMock } = vi.hoisted(() => ({
  namedTransformFindManyMock: vi.fn().mockResolvedValue([]),
}));
const { imageFindUniqueMock, recordImageDeliveryMock } = vi.hoisted(() => ({
  imageFindUniqueMock: vi.fn().mockResolvedValue({ id: 'img-1', fileSize: 10 }),
  recordImageDeliveryMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    namedTransformation: { findMany: namedTransformFindManyMock },
    image: { findUnique: imageFindUniqueMock },
  },
}));

vi.mock('@/lib/delivery-analytics', () => ({
  recordImageDelivery: recordImageDeliveryMock,
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

function makeRequest(path: string[], query = '') {
  return new NextRequest(`http://localhost/api/serve/${path.join('/')}${query}`);
}

const context = (path: string[]) => ({
  params: Promise.resolve({ path }),
});

describe('GET /api/serve/[...path]', () => {
  beforeEach(() => {
    namedTransformFindManyMock.mockReset().mockResolvedValue([]);
    imageFindUniqueMock.mockReset().mockResolvedValue({ id: 'img-1', fileSize: 10 });
    recordImageDeliveryMock.mockClear();
    getFromStorageMock.mockReset();
    getPublicUrlMock.mockReset();
    transformImageMock.mockReset();
    transformCache.clear();
  });

  it('serves original binary directly when there are no transforms', async () => {
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original-file-bytes'),
      contentType: 'image/webp',
    });

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp']),
      context(['2024', '01', 'a.webp'])
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.toString()).toBe('original-file-bytes');
  });

  it('returns 404 for an empty path', async () => {
    const response = await GET(makeRequest([]), context([]));
    expect(response.status).toBe(404);
  });

  it('applies transforms and returns binary', async () => {
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: 'image/webp',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('transformed'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=200&q=70'),
      context(['2024', '01', 'a.webp'])
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('max-age=31536000');
    expect(transformImageMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ w: 200, q: 70 }),
      undefined
    );
  });

  it('returns 404 when storage download fails', async () => {
    getFromStorageMock.mockRejectedValue(new Error('missing'));

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=100'),
      context(['2024', '01', 'a.webp'])
    );
    expect(response.status).toBe(404);
  });

  it('loads a tracked overlay before transformation', async () => {
    imageFindUniqueMock
      .mockResolvedValueOnce({ id: 'img-1', fileSize: 100 })
      .mockResolvedValueOnce({ storagePath: 'overlays/logo.png' });
    getFromStorageMock
      .mockResolvedValueOnce({ buffer: Buffer.from('source'), contentType: 'image/webp' })
      .mockResolvedValueOnce({ buffer: Buffer.from('overlay'), contentType: 'image/png' });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('output'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=100&overlay=overlay-1'),
      context(['2024', '01', 'a.webp'])
    );

    expect(response.status).toBe(200);
    expect(imageFindUniqueMock).toHaveBeenNthCalledWith(2, {
      where: { id: 'overlay-1' },
      select: { storagePath: true },
    });
    expect(transformImageMock).toHaveBeenCalledWith(
      Buffer.from('source'),
      expect.objectContaining({ overlayId: 'overlay-1' }),
      Buffer.from('overlay')
    );
  });

  it('serves repeated transforms from cache without re-processing', async () => {
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: 'image/webp',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('transformed'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const first = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=200&q=70'),
      context(['2024', '01', 'a.webp'])
    );
    expect(first.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledTimes(1);

    const second = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=200&q=70'),
      context(['2024', '01', 'a.webp'])
    );
    expect(second.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledTimes(1);
    expect(Buffer.from(await second.arrayBuffer()).toString()).toBe('transformed');
  });

  it('returns 500 when sharp transformation fails', async () => {
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('corrupt'),
      contentType: 'image/webp',
    });
    transformImageMock.mockRejectedValue(new Error('sharp failed'));

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp'], '?w=100'),
      context(['2024', '01', 'a.webp'])
    );
    expect(response.status).toBe(500);
  });

  describe('with signed delivery enabled', () => {
    const originalSecret = process.env.STORINARY_SIGNED_URL_SECRET;

    beforeEach(() => {
      process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';
      getFromStorageMock.mockResolvedValue({
        buffer: Buffer.from('original'),
        contentType: 'image/webp',
      });
      transformImageMock.mockResolvedValue({
        buffer: Buffer.from('transformed'),
        contentType: 'image/webp',
        format: 'webp',
      });
    });

    afterEach(() => {
      if (originalSecret === undefined) delete process.env.STORINARY_SIGNED_URL_SECRET;
      else process.env.STORINARY_SIGNED_URL_SECRET = originalSecret;
    });

    it('rejects a missing or invalid token before storage access', async () => {
      const missing = await GET(
        makeRequest(['2024', '01', 'a.webp'], '?w=200'),
        context(['2024', '01', 'a.webp'])
      );
      const invalid = await GET(
        makeRequest(['2024', '01', 'a.webp'], '?w=200&token=bad'),
        context(['2024', '01', 'a.webp'])
      );

      expect(missing.status).toBe(403);
      expect(invalid.status).toBe(403);
      expect(getFromStorageMock).not.toHaveBeenCalled();
    });

    it('accepts a valid token and disables shared caching', async () => {
      const futureSeconds = Math.floor(Date.now() / 1000) + 300;
      const token = createSignedUrlToken('2024/01/a.webp', futureSeconds);
      const response = await GET(
        makeRequest(['2024', '01', 'a.webp'], `?w=200&token=${encodeURIComponent(token)}`),
        context(['2024', '01', 'a.webp'])
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    });
  });
});
