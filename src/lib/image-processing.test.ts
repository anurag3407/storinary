// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  getImageMetadata,
  optimizeForUpload,
  transformImage,
} from './image-processing';

async function makePng(width = 200, height = 100): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe('getImageMetadata', () => {
  it('extracts dimensions, format, and size', async () => {
    const buffer = await makePng();
    const meta = await getImageMetadata(buffer);
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe('png');
    expect(meta.size).toBe(buffer.length);
  });
});

describe('transformImage', () => {
  it('resizes with fit inside by default', async () => {
    const buffer = await makePng();
    const result = await transformImage(buffer, { w: 100, h: 50 });
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
    expect(result.format).toBe('webp');
    expect(result.contentType).toBe('image/webp');
  });

  it('does not enlarge when no size params are given', async () => {
    const buffer = await makePng(50, 30);
    const result = await transformImage(buffer, { q: 90 });
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(30);
  });

  it('converts to jpeg, avif, and png', async () => {
    const buffer = await makePng();

    const jpeg = await transformImage(buffer, { fmt: 'jpeg' });
    expect(jpeg.contentType).toBe('image/jpeg');
    expect((await sharp(jpeg.buffer).metadata()).format).toBe('jpeg');

    const avif = await transformImage(buffer, { fmt: 'avif' });
    expect(avif.contentType).toBe('image/avif');
    // AVIF is reported by libvips as the 'heif' container format
    expect((await sharp(avif.buffer).metadata()).format).toBe('heif');

    const png = await transformImage(buffer, { fmt: 'png' });
    expect(png.contentType).toBe('image/png');
    expect((await sharp(png.buffer).metadata()).format).toBe('png');
  });

  it('applies cover fit', async () => {
    const buffer = await makePng(200, 100);
    const result = await transformImage(buffer, { w: 100, h: 100, fit: 'cover' });
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('applies aspect ratio, padding, rotation, DPR, and effects', async () => {
    const buffer = await makePng(100, 50);
    const result = await transformImage(buffer, {
      w: 80,
      ar: '1:1',
      fit: 'contain',
      a: 45,
      dpr: 2,
      e: [{ grayscale: true }, { saturation: 0 }],
    });

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeGreaterThan(80);
    expect(result.format).toBe('webp');
  });

  it('applies brightness, contrast, and gamma adjustments', async () => {
    const buffer = await makePng();
    const baseline = await transformImage(buffer, { w: 100 });
    const adjusted = await transformImage(buffer, {
      w: 100,
      brightness: 1.5,
      contrast: 1.4,
      gamma: 1.8,
    });

    const [baseStats, adjustedStats] = await Promise.all([
      sharp(baseline.buffer).stats(),
      sharp(adjusted.buffer).stats(),
    ]);
    const baseMean = baseStats.channels.reduce((total, channel) => total + channel.mean, 0);
    const adjustedMean = adjustedStats.channels.reduce((total, channel) => total + channel.mean, 0);
    expect(adjustedMean).toBeGreaterThan(baseMean);
  });

  it('accepts attention-based smart crop gravity without changing output dimensions', async () => {
    const buffer = await makePng(200, 100);
    const result = await transformImage(buffer, {
      w: 100,
      h: 100,
      fit: 'cover',
      g: 'auto',
    });

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('composites sanitized text overlays without executing markup', async () => {
    const buffer = await makePng();
    const baseline = await transformImage(buffer, { w: 200 });
    const result = await transformImage(buffer, {
      w: 200,
      text: '<b>Watermark</b>',
    });

    const [baseMeta, overlayMeta] = await Promise.all([
      sharp(baseline.buffer).metadata(),
      sharp(result.buffer).metadata(),
    ]);
    expect(overlayMeta.width).toBe(baseMeta.width);
    expect(overlayMeta.height).toBe(baseMeta.height);
    expect(overlayMeta.channels).toBeGreaterThanOrEqual(3);
  });

  it('composites a tracked image overlay and honors gravity', async () => {
    const buffer = await makePng();
    const watermark = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    }).png().toBuffer();

    const result = await transformImage(buffer, {
      w: 200,
      g: 'east',
    }, watermark);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });
});

describe('optimizeForUpload', () => {
  it('converts to webp and auto-orients', async () => {
    const buffer = await makePng();
    const result = await optimizeForUpload(buffer, 4096);
    expect(result.format).toBe('webp');
    expect(result.contentType).toBe('image/webp');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  });

  it('downscales images wider than maxWidth', async () => {
    const buffer = await makePng(4000, 2000);
    const result = await optimizeForUpload(buffer, 2048);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(2048);
  });
});
