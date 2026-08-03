import { describe, expect, it } from 'vitest';
import {
  generateLinks,
  generateShortId,
  getMimeType,
  parseTransformParams,
  serializeImage,
} from './utils';

describe('generateShortId', () => {
  it('returns an 8-character id', () => {
    expect(generateShortId()).toHaveLength(8);
  });

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateShortId()));
    expect(ids.size).toBe(100);
  });
});

describe('serializeImage', () => {
  it('serializes a Prisma image into the API-facing shape', () => {
    const created = new Date('2024-01-01T00:00:00Z');
    const updated = new Date('2024-01-02T00:00:00Z');

    const result = serializeImage({
      id: 'img-1',
      originalName: 'photo.jpg',
      storagePath: '2024/01/photo-abc12345.jpg',
      publicUrl: 'https://cdn.example/2024/01/photo-abc12345.jpg',
      width: 800,
      height: 600,
      fileSize: 12345,
      format: 'jpeg',
      mimeType: 'image/jpeg',
      folder: '/products',
      tags: 'hero,product',
      altText: 'A product photo',
      bgRemoved: false,
      compressed: true,
      createdAt: created,
      updatedAt: updated,
    });

    expect(result).toEqual({
      id: 'img-1',
      originalName: 'photo.jpg',
      storagePath: '2024/01/photo-abc12345.jpg',
      publicUrl: 'https://cdn.example/2024/01/photo-abc12345.jpg',
      width: 800,
      height: 600,
      fileSize: 12345,
      format: 'jpeg',
      mimeType: 'image/jpeg',
      folder: '/products',
      tags: 'hero,product',
      altText: 'A product photo',
      bgRemoved: false,
      compressed: true,
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    });
  });
});

describe('generateLinks', () => {
  const publicUrl = 'https://cdn.example/2024/01/photo-abc12345.webp';
  const storagePath = '2024/01/photo-abc12345.webp';

  it('generates all link formats', () => {
    const links = generateLinks(
      publicUrl,
      storagePath,
      'My photo',
      'http://localhost:3000'
    );

    expect(links.direct).toBe(publicUrl);
    expect(links.html).toBe(
      '<img src="https://cdn.example/2024/01/photo-abc12345.webp" alt="My photo" loading="lazy" />'
    );
    expect(links.markdown).toBe(
      '![My photo](https://cdn.example/2024/01/photo-abc12345.webp)'
    );
    expect(links.css).toBe(
      "background-image: url('https://cdn.example/2024/01/photo-abc12345.webp');"
    );
    expect(links.transformBase).toBe(
      'http://localhost:3000/api/serve/2024/01/photo-abc12345.webp'
    );
  });

  it('falls back to "image" alt text when empty', () => {
    const links = generateLinks(publicUrl, storagePath, '', '');
    expect(links.html).toContain('alt="image"');
    expect(links.markdown).toBe(`![image](${publicUrl})`);
  });
});

describe('parseTransformParams', () => {
  const toSearchParams = (obj: Record<string, string>) =>
    new URLSearchParams(obj);

  it('parses valid width, height, quality', () => {
    const params = parseTransformParams(
      toSearchParams({ w: '800', h: '600', q: '75' })
    );
    expect(params.w).toBe(800);
    expect(params.h).toBe(600);
    expect(params.q).toBe(75);
  });

  it('clamps values to valid ranges', () => {
    const params = parseTransformParams(
      toSearchParams({ w: '99999', h: '-5', q: '500' })
    );
    expect(params.w).toBe(8192);
    expect(params.q).toBe(100);
    expect(params.h).toBe(1); // -5 clamps to the minimum of 1
  });

  it('parses format and fit when valid', () => {
    const params = parseTransformParams(
      toSearchParams({ fmt: 'avif', fit: 'cover' })
    );
    expect(params.fmt).toBe('avif');
    expect(params.fit).toBe('cover');
  });

  it('ignores invalid format and fit', () => {
    const params = parseTransformParams(
      toSearchParams({ fmt: 'bmp', fit: 'stretch' })
    );
    expect(params.fmt).toBeUndefined();
    expect(params.fit).toBeUndefined();
  });

  it('returns empty params for an empty query', () => {
    expect(parseTransformParams(new URLSearchParams(''))).toEqual({});
  });
});

describe('getMimeType', () => {
  it('maps known extensions', () => {
    expect(getMimeType('a.jpg')).toBe('image/jpeg');
    expect(getMimeType('a.JPEG')).toBe('image/jpeg');
    expect(getMimeType('a.png')).toBe('image/png');
    expect(getMimeType('a.webp')).toBe('image/webp');
    expect(getMimeType('a.svg')).toBe('image/svg+xml');
    expect(getMimeType('a.gif')).toBe('image/gif');
    expect(getMimeType('a.avif')).toBe('image/avif');
  });

  it('falls back for unknown extensions', () => {
    expect(getMimeType('a.xyz')).toBe('application/octet-stream');
    expect(getMimeType('noext')).toBe('application/octet-stream');
  });
});
