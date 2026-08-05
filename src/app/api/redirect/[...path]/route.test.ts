// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { imageMock } = vi.hoisted(() => ({
  imageMock: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { image: imageMock },
}));

const MOCK_ROW = {
  id: 'img-1',
  originalName: 'hero.jpg',
  storagePath: 'products/hero.jpg',
  publicUrl: 'https://cdn.example/storinary/products/hero.jpg',
  width: 800,
  height: 600,
  fileSize: 1000,
  format: 'jpg',
  mimeType: 'image/jpeg',
  folder: '/products',
  tags: '',
  altText: '',
  bgRemoved: false,
  compressed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

function makeRequest(segments: string[]) {
  return new NextRequest(`http://localhost/api/redirect/${segments.join('/')}`);
}

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('GET /api/redirect/[...path]', () => {
  beforeEach(() => {
    imageMock.findUnique.mockReset();
    imageMock.findFirst.mockReset();
  });

  it('301s to the public URL for a plain Cloudinary path', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    const response = await GET(
      makeRequest(['image', 'upload', 'v123456', 'products', 'hero.jpg']),
      context(['image', 'upload', 'v123456', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(MOCK_ROW.publicUrl);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'products/hero.jpg' },
    });
  });

  it('translates comma-packed Cloudinary transforms into serve params', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    const response = await GET(
      makeRequest(['image', 'upload', 'w_100,h_100,q_70,f_webp', 'v9', 'products', 'hero.jpg']),
      context(['image', 'upload', 'w_100,h_100,q_70,f_webp', 'v9', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/api/serve/products/hero.jpg');
    expect(location).toContain('w=100');
    expect(location).toContain('h=100');
    expect(location).toContain('q=70');
    expect(location).toContain('fmt=webp');
  });

  it('maps c_fill → fit=cover and f_auto → no format param', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    const response = await GET(
      makeRequest(['image', 'upload', 'c_fill,w_200,h_200,f_auto', 'v1', 'products', 'hero.jpg']),
      context(['image', 'upload', 'c_fill,w_200,h_200,f_auto', 'v1', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location).toContain('fit=cover');
    expect(location).toContain('w=200');
    expect(location).not.toContain('fmt=');
  });

  it('falls back to a prefix lookup when the extension differs (f_auto formats)', async () => {
    imageMock.findUnique.mockResolvedValue(null); // exact "hero.webp" doesn't exist
    imageMock.findFirst.mockResolvedValue(MOCK_ROW); // "hero.jpg" does

    const response = await GET(
      makeRequest(['v12', 'products', 'hero.webp']),
      context(['v12', 'products', 'hero.webp'])
    );

    expect(response.status).toBe(301);
    expect(imageMock.findFirst).toHaveBeenCalledWith({
      where: { storagePath: { startsWith: 'products/hero.' } },
    });
  });

  it('404s for an unknown image', async () => {
    imageMock.findUnique.mockResolvedValue(null);
    imageMock.findFirst.mockResolvedValue(null);

    const response = await GET(
      makeRequest(['image', 'upload', 'v1', 'nope', 'x.png']),
      context(['image', 'upload', 'v1', 'nope', 'x.png'])
    );
    expect(response.status).toBe(404);
  });

  it('does not eat public_ids that contain underscores', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    // "my_folder/hero_image" looks like transform segments but is a real path
    const response = await GET(
      makeRequest(['image', 'upload', 'v42', 'my_folder', 'hero_image.jpg']),
      context(['image', 'upload', 'v42', 'my_folder', 'hero_image.jpg'])
    );

    expect(response.status).toBe(301);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'my_folder/hero_image.jpg' },
    });
  });

  it('keeps version-looking folder names in the path after the head is parsed', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    // Real Cloudinary version first, then a folder literally named "v123"
    const response = await GET(
      makeRequest(['image', 'upload', 'v1', 'v123', 'pic.jpg']),
      context(['image', 'upload', 'v1', 'v123', 'pic.jpg'])
    );

    expect(response.status).toBe(301);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'v123/pic.jpg' },
    });
  });

  it('404s for an empty path', async () => {
    const response = await GET(makeRequest([]), context([]));
    expect(response.status).toBe(404);
  });
});
