// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { findUniqueMock, getFromStorageMock, transformImageMock } =
  vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    getFromStorageMock: vi.fn(),
    transformImageMock: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: { findUnique: findUniqueMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
}));

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
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
    findUniqueMock.mockReset();
    getFromStorageMock.mockReset();
    transformImageMock.mockReset();
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
      expect.objectContaining({ w: 100, fmt: 'jpeg', q: 50 })
    );
  });

  it('returns 404 when the storage fetch fails', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    getFromStorageMock.mockRejectedValue(new Error('missing'));

    const response = await GET(makeRequest('?w=50'), context);
    expect(response.status).toBe(404);
  });
});
