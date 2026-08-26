// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { transformCache } from '@/lib/transform-cache';

const { findUniqueMock, getFromStorageMock, transformImageMock, diskCacheGetMock, diskCacheSetMock } =
  vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    getFromStorageMock: vi.fn(),
    transformImageMock: vi.fn(),
    diskCacheGetMock: vi.fn().mockResolvedValue(null),
    diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  }));

  const { namedTransformFindManyMock } = vi.hoisted(() => ({
    namedTransformFindManyMock: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: { findUnique: findUniqueMock },
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

const ROW = {
  id: 'img-1',
  originalName: 'a.webp',
  storagePath: '2024/01/a.webp',
  publicUrl: 'https://cdn.example/a.webp',
  width: 100,
  height: 100,
  fileSize: 1000,
  format: 'webp',
  mimeType: 'image/webp',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  aiModerated: false,
  aiModerationScore: null,
  compressed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const context = { params: Promise.resolve({ id: 'img-1' }) };

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/images/img-1/transform${query}`);
}

describe('GET /api/images/:id/transform', () => {
  beforeEach(() => {
    namedTransformFindManyMock.mockReset().mockResolvedValue([]);
    findUniqueMock.mockReset();
    getFromStorageMock.mockReset();
    transformImageMock.mockReset();
    transformCache.clear();
  });

  it('returns 404 when the image record is missing', async () => {
    findUniqueMock.mockResolvedValue(null);
    const response = await GET(makeRequest(), context);
    expect(response.status).toBe(404);
  });

  it('serves the original file when no transforms are requested', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: 'image/webp',
    });

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(transformImageMock).not.toHaveBeenCalled();
  });

  it('applies transforms and returns the processed binary', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: 'image/webp',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('tiny'),
      contentType: 'image/jpeg',
      format: 'jpeg',
    });

    const response = await GET(makeRequest('?w=100&fmt=jpeg&q=50'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(transformImageMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ w: 100, fmt: 'jpeg', q: 50 }),
      undefined
    );
  });

  it('returns 404 when the storage fetch fails', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockRejectedValue(new Error('missing'));

    const response = await GET(makeRequest('?w=50'), context);
    expect(response.status).toBe(404);
  });

  it('serves repeated transforms from cache without re-processing', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: 'image/webp',
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('tiny'),
      contentType: 'image/jpeg',
      format: 'jpeg',
    });

    const first = await GET(makeRequest('?w=100&fmt=jpeg&q=50'), context);
    expect(first.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledTimes(1);

    const second = await GET(makeRequest('?w=100&fmt=jpeg&q=50'), context);
    expect(second.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledTimes(1);
    expect(Buffer.from(await second.arrayBuffer()).toString()).toBe('tiny');
  });

  it('returns 500 when sharp transformation fails', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('corrupt'),
      contentType: 'image/webp',
    });
    transformImageMock.mockRejectedValue(new Error('sharp failed'));

    const response = await GET(makeRequest('?w=50'), context);
    expect(response.status).toBe(500);
  });

  it('hardens untransformed SVG responses', async () => {
    findUniqueMock.mockResolvedValue({ ...ROW, format: 'svg' });
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      contentType: 'image/svg+xml',
    });

    const response = await GET(makeRequest(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
