// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { transformCache } from '@/lib/transform-cache';

const { getFromStorageMock, getPublicUrlMock, transformImageMock } =
  vi.hoisted(() => ({
    getFromStorageMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    transformImageMock: vi.fn(),
  }));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
  getPublicUrl: getPublicUrlMock,
}));

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
}));

function makeRequest(path: string[], query = '') {
  return new NextRequest(`http://localhost/api/serve/${path.join('/')}${query}`);
}

const context = (path: string[]) => ({
  params: Promise.resolve({ path }),
});

describe('GET /api/serve/[...path]', () => {
  beforeEach(() => {
    getFromStorageMock.mockReset();
    getPublicUrlMock.mockReset();
    transformImageMock.mockReset();
    transformCache.clear();
  });

  it('redirects to the CDN when there are no transforms', async () => {
    getPublicUrlMock.mockReturnValue('https://cdn.example/2024/01/a.webp');

    const response = await GET(
      makeRequest(['2024', '01', 'a.webp']),
      context(['2024', '01', 'a.webp'])
    );

    expect(response.status).toBe(301); // NextResponse.redirect(_, 301)
    expect(response.headers.get('location')).toBe('https://cdn.example/2024/01/a.webp');
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
      expect.objectContaining({ w: 200, q: 70 })
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
});
