// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createSignedUrlToken } from '@/lib/signed-delivery';

const {
  imageMock,
  videoMock,
  videoRenditionMock,
  getFromStorageMock,
  transformImageMock,
  diskCacheGetMock,
  diskCacheSetMock,
  recordVideoDeliveryMock,
  getVideoFromStorageMock,
  recordImageDeliveryMock,
} = vi.hoisted(() => ({
  imageMock: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  videoMock: { findFirst: vi.fn() },
  videoRenditionMock: { findUnique: vi.fn() },
  getFromStorageMock: vi.fn(),
  transformImageMock: vi.fn(),
  diskCacheGetMock: vi.fn().mockResolvedValue(null),
  diskCacheSetMock: vi.fn().mockResolvedValue(undefined),
  recordImageDeliveryMock: vi.fn().mockResolvedValue(undefined),
  recordVideoDeliveryMock: vi.fn().mockResolvedValue(undefined),
  getVideoFromStorageMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: imageMock,
    video: videoMock,
    videoRendition: videoRenditionMock,
  },
}));

vi.mock('@/lib/storage', () => ({
  getFromStorage: getFromStorageMock,
  getVideoFromStorage: getVideoFromStorageMock,
}));

vi.mock('@/lib/image-processing', () => ({
  transformImage: transformImageMock,
}));

vi.mock('@/lib/transform-cache', () => ({
  transformCache: { get: vi.fn(), set: vi.fn(), clear: vi.fn() },
  transformCacheKey: vi.fn((key: string, params: Record<string, unknown>) =>
    `${key}?${JSON.stringify(params)}`
  ),
}));

vi.mock('@/lib/disk-cache', () => ({
  diskCache: { get: diskCacheGetMock, set: diskCacheSetMock },
}));

vi.mock('@/lib/delivery-analytics', () => ({
  recordImageDelivery: recordImageDeliveryMock,
  recordVideoDelivery: recordVideoDeliveryMock,
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
  aiModerated: false,
  aiModerationScore: null,
  compressed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

function makeRequest(segments: string[]) {
  return new NextRequest(`http://localhost/api/redirect/${segments.join('/')}`);
}

beforeEach(() => {
  delete process.env.STORINARY_SIGNED_URL_SECRET;
  delete process.env.STORINARY_ADMIN_PASSWORD;
  getFromStorageMock.mockReset();
  transformImageMock.mockReset();
  getVideoFromStorageMock.mockReset();
  recordImageDeliveryMock.mockClear();
  recordVideoDeliveryMock.mockClear();
});

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('GET /api/redirect/[...path]', () => {
  beforeEach(() => {
    imageMock.findUnique.mockReset();
    imageMock.findFirst.mockReset();
  });

  it('serves a plain Cloudinary path directly', async () => {
    imageMock.findFirst.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: MOCK_ROW.mimeType,
    });

    const response = await GET(
      makeRequest(['image', 'upload', 'v123456', 'products', 'hero.jpg']),
      context(['image', 'upload', 'v123456', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(MOCK_ROW.mimeType);
    expect(await response.text()).toBe('original');
    expect(getFromStorageMock).toHaveBeenCalledWith(MOCK_ROW.storagePath);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'products/hero.jpg' },
    });
  });

  it('serves comma-packed Cloudinary transforms without another redirect', async () => {
    imageMock.findFirst.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: MOCK_ROW.mimeType,
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('transformed'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['image', 'upload', 'w_100,h_100,q_70,f_webp', 'v9', 'products', 'hero.jpg']),
      context(['image', 'upload', 'w_100,h_100,q_70,f_webp', 'v9', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('transformed');
    expect(transformImageMock).toHaveBeenCalledWith(Buffer.from('original'), expect.objectContaining({
      w: '100',
      h: '100',
      q: '70',
      fmt: 'webp',
    }));
    expect(recordImageDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      imageId: MOCK_ROW.id,
      kind: 'transform',
    }));
  });

  it('maps c_fill → fit=cover and f_auto → no format param', async () => {
    imageMock.findFirst.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: MOCK_ROW.mimeType,
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('cropped'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['image', 'upload', 'c_fill,w_200,h_200', 'v1', 'products', 'hero.jpg']),
      context(['image', 'upload', 'c_fill,w_200,h_200', 'v1', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledWith(Buffer.from('original'), expect.objectContaining({
      fit: 'cover',
      w: '200',
    }));
    expect(transformImageMock.mock.calls[0][1]).not.toHaveProperty('fmt');
  });

  it('maps Cloudinary g_auto to attention-based smart cropping', async () => {
    imageMock.findFirst.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: MOCK_ROW.mimeType,
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('smart'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['image', 'upload', 'g_auto,c_fill,w_100,h_100', 'products', 'hero']),
      context(['image', 'upload', 'g_auto,c_fill,w_100,h_100', 'products', 'hero'])
    );

    expect(response.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledWith(Buffer.from('original'), expect.objectContaining({
      g: 'auto',
      fit: 'cover',
      w: '100',
      h: '100',
    }));
  });

  it('maps Cloudinary text overlays to the sanitized overlay parameter', async () => {
    imageMock.findFirst.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('original'),
      contentType: MOCK_ROW.mimeType,
    });
    transformImageMock.mockResolvedValue({
      buffer: Buffer.from('watermarked'),
      contentType: 'image/webp',
      format: 'webp',
    });

    const response = await GET(
      makeRequest(['image', 'upload', 'l_text:Arial_40_Hello_World,w_200', 'v1', 'products', 'hero.jpg']),
      context(['image', 'upload', 'l_text:Arial_40_Hello_World,w_200', 'v1', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(200);
    expect(transformImageMock).toHaveBeenCalledWith(Buffer.from('original'), expect.objectContaining({
      text: 'Hello World',
      w: '200',
    }));
  });

  it('falls back to a prefix lookup and serves the matched original', async () => {
    imageMock.findUnique.mockResolvedValue(null); // exact "hero.webp" doesn't exist
    imageMock.findFirst.mockResolvedValue(MOCK_ROW); // "hero.jpg" does
    getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('matched'),
      contentType: MOCK_ROW.mimeType,
    });

    const response = await GET(
      makeRequest(['v12', 'products', 'hero.webp']),
      context(['v12', 'products', 'hero.webp'])
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('matched');
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
    getFromStorageMock.mockResolvedValue({ buffer: Buffer.from('x'), contentType: MOCK_ROW.mimeType });

    // "my_folder/hero_image" looks like transform segments but is a real path
    const response = await GET(
      makeRequest(['image', 'upload', 'v42', 'my_folder', 'hero_image.jpg']),
      context(['image', 'upload', 'v42', 'my_folder', 'hero_image.jpg'])
    );

    expect(response.status).toBe(200);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'my_folder/hero_image.jpg' },
    });
  });

  it('keeps version-looking folder names in the path after the head is parsed', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    getFromStorageMock.mockResolvedValue({ buffer: Buffer.from('x'), contentType: MOCK_ROW.mimeType });

    // Real Cloudinary version first, then a folder literally named "v123"
    const response = await GET(
      makeRequest(['image', 'upload', 'v1', 'v123', 'pic.jpg']),
      context(['image', 'upload', 'v1', 'v123', 'pic.jpg'])
    );

    expect(response.status).toBe(200);
    expect(imageMock.findUnique).toHaveBeenCalledWith({
      where: { storagePath: 'v123/pic.jpg' },
    });
  });

  it('404s for an empty path', async () => {
    const response = await GET(makeRequest([]), context([]));
    expect(response.status).toBe(404);
  });
});

describe('signed native Cloudinary delivery', () => {
  beforeEach(() => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-secret';
    getFromStorageMock.mockReset().mockResolvedValue({
      buffer: Buffer.from('private'),
      contentType: MOCK_ROW.mimeType,
    });
  });

  afterEach(() => {
    delete process.env.STORINARY_SIGNED_URL_SECRET;
  });

  it('rejects missing tokens before lookup or storage access', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    const response = await GET(
      makeRequest(['image', 'upload', 'v1', 'products', 'hero.jpg']),
      context(['image', 'upload', 'v1', 'products', 'hero.jpg'])
    );

    expect(response.status).toBe(403);
    expect(imageMock.findUnique).not.toHaveBeenCalled();
    expect(getFromStorageMock).not.toHaveBeenCalled();
  });

  it('accepts a token signed for the Cloudinary-style route', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    const pathname = '/api/redirect/image/upload/v1/products/hero.jpg';
    const token = createSignedUrlToken('image/upload/v1/products/hero.jpg', Math.floor(Date.now() / 1000) + 60);
    const request = new NextRequest(`http://localhost${pathname}?token=${encodeURIComponent(token)}`);
    const response = await GET(request, {
      params: Promise.resolve({ path: ['image', 'upload', 'v1', 'products', 'hero.jpg'] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('native Cloudinary video delivery', () => {
  const video = {
    id: 'video-1',
    storagePath: 'videos/clip.mp4',
    mimeType: 'video/mp4',
    fileSize: 100,
  };
  const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

  beforeEach(() => {
    videoMock.findFirst.mockReset().mockResolvedValue(video);
    videoRenditionMock.findUnique.mockReset().mockResolvedValue(null);
    getVideoFromStorageMock.mockReset();
  });

  it('serves the full original and records delivery', async () => {
    getVideoFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('0123456789'),
      contentType: 'video/mp4',
    });

    const response = await GET(
      makeRequest(['video', 'upload', 'v7', 'videos', 'clip.mp4']),
      context(['video', 'upload', 'v7', 'videos', 'clip.mp4'])
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('0123456789');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(getVideoFromStorageMock).toHaveBeenCalledWith('videos/clip.mp4');
    expect(recordVideoDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      videoId: 'video-1',
      label: null,
      bytes: 10,
    }));
  });

  it('supports HTTP range playback', async () => {
    getVideoFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('456'),
      contentType: 'video/mp4',
      totalSize: 100,
      rangeStatus: 206,
    });

    const request = new NextRequest(
      'http://localhost/api/redirect/video/upload/v7/videos/clip.mp4',
      { headers: { range: 'bytes=4-6' } }
    );
    const response = await GET(request, context(['video', 'upload', 'v7', 'videos', 'clip.mp4']));

    expect(response.status).toBe(206);
    expect(await response.text()).toBe('456');
    expect(response.headers.get('content-range')).toBe('bytes 4-6/100');
    expect(getVideoFromStorageMock).toHaveBeenCalledWith('videos/clip.mp4', 'bytes=4-6');
  });

  it('resolves a requested rendition by label', async () => {
    videoRenditionMock.findUnique.mockResolvedValue({
      id: 'rendition-1',
      label: '720p',
      storagePath: 'videos/clip-720p.mp4',
      fileSize: 50,
    });
    getVideoFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('rendition'),
      contentType: 'video/mp4',
    });

    const request = new NextRequest('http://localhost/api/redirect/video/upload/v7/videos/clip.mp4?rendition=720p');
    const response = await GET(request, context(['video', 'upload', 'v7', 'videos', 'clip.mp4']));

    expect(response.status).toBe(200);
    expect(getVideoFromStorageMock).toHaveBeenCalledWith('videos/clip-720p.mp4');
    expect(recordVideoDeliveryMock).toHaveBeenCalledWith(expect.objectContaining({
      label: '720p',
    }));
  });
});
