// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateEagerTransforms } from './eager-transforms';
import sharp from 'sharp';

const { uploadToStorageMock, getPublicUrlMock } = vi.hoisted(() => ({
  uploadToStorageMock: vi.fn().mockResolvedValue({ path: 'test' }),
  getPublicUrlMock: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

vi.mock('./storage', () => ({
  uploadToStorage: uploadToStorageMock,
  getPublicUrl: getPublicUrlMock,
}));

describe('generateEagerTransforms', () => {
  beforeEach(() => {
    uploadToStorageMock.mockClear();
    getPublicUrlMock.mockClear();
  });

  it('skips eager transforms for svg and gif formats', async () => {
    const dummyBuffer = Buffer.from('svg');
    const svgRes = await generateEagerTransforms(dummyBuffer, '2024/01/a.svg', 'svg');
    const gifRes = await generateEagerTransforms(dummyBuffer, '2024/01/a.gif', 'gif');

    expect(svgRes).toEqual([]);
    expect(gifRes).toEqual([]);
    expect(uploadToStorageMock).not.toHaveBeenCalled();
  });

  it('generates variants smaller than original image width', async () => {
    // Create a 1000x1000 PNG buffer
    const inputBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const variants = await generateEagerTransforms(
      inputBuffer,
      '2024/08/photo.png',
      'png'
    );

    // 1000px width should produce 'thumb' (200px) and 'medium' (800px), but skip 'large' (1600px)
    expect(variants.length).toBe(2);
    expect(variants.map((v) => v.label)).toEqual(['thumb', 'medium']);
    expect(uploadToStorageMock).toHaveBeenCalledTimes(2);
    expect(variants[0].publicUrl).toBe('https://cdn.example/2024/08/photo_thumb.webp');
  });
});
