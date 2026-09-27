// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { fetchRemoteAssetMock, transformImageMock, diskCacheGetMock, diskCacheSetMock } =
  vi.hoisted(() => ({
    fetchRemoteAssetMock: vi.fn(),
    transformImageMock: vi.fn(),
    diskCacheGetMock: vi.fn().mockResolvedValue(null),
    diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('@/lib/remote-import', () => ({
  fetchRemoteAsset: fetchRemoteAssetMock,
}));

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
}));

vi.mock('@/lib/disk-cache', () => ({
  diskCache: {
    get: diskCacheGetMock,
    set: diskCacheSetMock,
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

const { orgFindUniqueMock } = vi.hoisted(() => ({
  orgFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: orgFindUniqueMock },
  };
  return { prisma: scoped, rawPrisma: scoped };
});

describe('Cloudinary image/fetch route [cloudName]/[resourceType]/fetch/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgFindUniqueMock.mockResolvedValue({ id: 'org-123', slug: 'demo' });
  });

  it('rejects non-image resource types', async () => {
    const req = new NextRequest('http://localhost:3000/demo/video/fetch/https://example.com/video.mp4');
    const res = await GET(req, {
      params: Promise.resolve({
        cloudName: 'demo',
        resourceType: 'video',
        path: ['https://example.com/video.mp4'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when invalid or non-HTTPS remote URL is supplied', async () => {
    const req = new NextRequest('http://localhost:3000/demo/image/fetch/invalid-url');
    const res = await GET(req, {
      params: Promise.resolve({
        cloudName: 'demo',
        resourceType: 'image',
        path: ['invalid-url'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('fetches and transforms remote image on the fly', async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      buffer: Buffer.from('remote-image-bytes'),
      contentType: 'image/png',
      filename: 'cat.png',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('transformed-cat-bytes'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const req = new NextRequest(
      'http://localhost:3000/demo/image/fetch/w_300,h_300,c_fill/https://upload.wikimedia.org/cat.png'
    );
    const res = await GET(req, {
      params: Promise.resolve({
        cloudName: 'demo',
        resourceType: 'image',
        path: ['w_300,h_300,c_fill', 'https://upload.wikimedia.org/cat.png'],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(fetchRemoteAssetMock).toHaveBeenCalledWith(
      'https://upload.wikimedia.org/cat.png',
      expect.any(Array),
      expect.any(Number)
    );
    expect(transformImageMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ w: 300, h: 300, fit: 'cover' }),
      undefined,
      null
    );
  });
});
