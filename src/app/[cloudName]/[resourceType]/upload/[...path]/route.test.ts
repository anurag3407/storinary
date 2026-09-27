// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { getFromStorageMock, getVideoFromStorageMock, transformImageMock, diskCacheGetMock, diskCacheSetMock } =
  vi.hoisted(() => ({
    getFromStorageMock: vi.fn(),
    getVideoFromStorageMock: vi.fn(),
    transformImageMock: vi.fn(),
    diskCacheGetMock: vi.fn().mockResolvedValue(null),
    diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
  getVideoFromStorage: getVideoFromStorageMock,
  getPublicUrl: (path: string) => `https://cdn.example.com/${path}`,
}));

const { orgFindUniqueMock, imageFindFirstMock, videoFindFirstMock, namedTransformFindManyMock } = vi.hoisted(() => ({
  orgFindUniqueMock: vi.fn(),
  imageFindFirstMock: vi.fn(),
  videoFindFirstMock: vi.fn(),
  namedTransformFindManyMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: orgFindUniqueMock },
    image: { findFirst: imageFindFirstMock },
    video: { findFirst: videoFindFirstMock },
    namedTransformation: { findMany: namedTransformFindManyMock },
  };
  return { prisma: scoped, rawPrisma: scoped };
});

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
  negotiateFormat: () => 'webp',
  negotiateQuality: () => 80,
}));

vi.mock('@/lib/delivery-analytics', () => ({
  recordImageDelivery: vi.fn().mockResolvedValue(undefined),
  recordVideoDelivery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/disk-cache', () => ({
  diskCache: {
    get: diskCacheGetMock,
    set: diskCacheSetMock,
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Cloudinary URL delivery route [cloudName]/[resourceType]/upload/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgFindUniqueMock.mockResolvedValue({ id: 'org-123', slug: 'demo' });
  });

  it('returns 404 for invalid resourceType', async () => {
    const req = new NextRequest('http://localhost:3000/demo/audio/upload/sample.mp3');
    const res = await GET(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'audio', path: ['sample.mp3'] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 if cloudName does not exist', async () => {
    orgFindUniqueMock.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3000/nonexistent/image/upload/sample.jpg');
    const res = await GET(req, {
      params: Promise.resolve({ cloudName: 'nonexistent', resourceType: 'image', path: ['sample.jpg'] }),
    });
    expect(res.status).toBe(404);
  });

  it('delivers an original image when no transforms are specified', async () => {
    imageFindFirstMock.mockResolvedValue({
      id: 'img-1',
      storagePath: 'demo/sample.jpg',
      fileSize: 1024,
      format: 'jpg',
      mimeType: 'image/jpeg',
    });
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('fake-image-bytes'),
      contentType: 'image/jpeg',
    });

    const req = new NextRequest('http://localhost:3000/demo/image/upload/sample.jpg');
    const res = await GET(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image', path: ['sample.jpg'] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('public');
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe('fake-image-bytes');
  });

  it('transforms an image on the fly with Cloudinary tokens and version tags', async () => {
    imageFindFirstMock.mockResolvedValue({
      id: 'img-1',
      storagePath: 'demo/sample.jpg',
      fileSize: 1024,
      format: 'jpg',
      mimeType: 'image/jpeg',
    });
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('raw-image-bytes'),
      contentType: 'image/jpeg',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('transformed-webp-bytes'),
      contentType: 'image/webp',
      format: 'webp',
      isAutoFormat: true,
    });

    const req = new NextRequest(
      'http://localhost:3000/demo/image/upload/w_500,h_300,c_fill,r_max/v1727400000/sample.jpg'
    );
    const res = await GET(req, {
      params: Promise.resolve({
        cloudName: 'demo',
        resourceType: 'image',
        path: ['w_500,h_300,c_fill,r_max', 'v1727400000', 'sample.jpg'],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(transformImageMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ w: 500, h: 300, fit: 'cover', r: 'max' }),
      undefined,
      null
    );
  });

  it('streams a video with HTTP 206 for range requests', async () => {
    videoFindFirstMock.mockResolvedValue({
      id: 'vid-1',
      storagePath: 'demo/movie.mp4',
      posterPath: 'demo/movie-poster.jpg',
      fileSize: 5000000,
      mimeType: 'video/mp4',
    });
    getVideoFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('video-range-chunk'),
      contentType: 'video/mp4',
    });

    const req = new NextRequest('http://localhost:3000/demo/video/upload/movie.mp4', {
      headers: { range: 'bytes=0-1024' },
    });
    const res = await GET(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'video', path: ['movie.mp4'] }),
    });

    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1024/5000000');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
  });

  it('extracts and delivers video poster when .jpg is requested on a video', async () => {
    videoFindFirstMock.mockResolvedValue({
      id: 'vid-1',
      storagePath: 'demo/movie.mp4',
      posterPath: 'demo/movie-poster.jpg',
      fileSize: 5000000,
      mimeType: 'video/mp4',
    });
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('poster-image-bytes'),
      contentType: 'image/jpeg',
    });

    const req = new NextRequest('http://localhost:3000/demo/video/upload/movie.jpg');
    const res = await GET(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'video', path: ['movie.jpg'] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe('poster-image-bytes');
  });
});
