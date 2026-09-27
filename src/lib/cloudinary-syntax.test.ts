import { describe, expect, it } from 'vitest';
import {
  isCloudinaryTransformSegment,
  parseCloudinaryPath,
  parseCloudinaryToken,
  buildCloudinaryTransformString,
  buildCloudinaryUrl,
} from './cloudinary-syntax';

describe('cloudinary-syntax', () => {
  it('identifies valid Cloudinary transformation segments', () => {
    expect(isCloudinaryTransformSegment('w_500,h_300,c_fill')).toBe(true);
    expect(isCloudinaryTransformSegment('f_auto,q_auto')).toBe(true);
    expect(isCloudinaryTransformSegment('e_blur:100')).toBe(true);
    expect(isCloudinaryTransformSegment('g_face,ar_16:9')).toBe(true);

    // Negative tests: ordinary storage paths
    expect(isCloudinaryTransformSegment('2026')).toBe(false);
    expect(isCloudinaryTransformSegment('photo.jpg')).toBe(false);
    expect(isCloudinaryTransformSegment('uploads/hero.png')).toBe(false);
    expect(isCloudinaryTransformSegment('')).toBe(false);
  });

  it('parses individual Cloudinary tokens correctly', () => {
    const params: Record<string, unknown> = {};

    parseCloudinaryToken('w_800', params);
    expect(params.w).toBe(800);

    parseCloudinaryToken('h_600', params);
    expect(params.h).toBe(600);

    parseCloudinaryToken('c_fill', params);
    expect(params.fit).toBe('cover');

    parseCloudinaryToken('f_auto', params);
    expect(params.fmt).toBe('auto');

    parseCloudinaryToken('q_auto', params);
    expect(params.q).toBe('auto');

    parseCloudinaryToken('g_face', params);
    expect(params.g).toBe('face');

    parseCloudinaryToken('ar_16:9', params);
    expect(params.ar).toBe('16:9');

    parseCloudinaryToken('a_90', params);
    expect(params.a).toBe(90);

    parseCloudinaryToken('b_white', params);
    expect(params.b).toBe('white');

    parseCloudinaryToken('dpr_2', params);
    expect(params.dpr).toBe(2);

    parseCloudinaryToken('e_grayscale', params);
    expect(params.e).toEqual([{ grayscale: true }]);

    parseCloudinaryToken('r_max', params);
    expect(params.r).toBe('max');

    parseCloudinaryToken('r_35', params);
    expect(params.r).toBe('35');
  });

  it('parses chained Cloudinary segments and separates storage path, stripping versions', () => {
    const input = ['w_500,h_300,c_fill', 'r_max', 'v1727400000', '2026', '09', 'photo.jpg'];
    const result = parseCloudinaryPath(input);

    expect(result.transformParams).toEqual({
      w: 500,
      h: 300,
      fit: 'cover',
      r: 'max',
    });
    expect(result.storagePath).toBe('2026/09/photo.jpg');
  });

  it('handles standard path with no Cloudinary segment', () => {
    const input = ['2026', '09', 'photo.jpg'];
    const result = parseCloudinaryPath(input);

    expect(result.transformParams).toEqual({});
    expect(result.storagePath).toBe('2026/09/photo.jpg');
  });

  it('reconstructs Cloudinary transform string with corner radius', () => {
    const str = buildCloudinaryTransformString({
      w: 800,
      h: 400,
      fit: 'cover',
      fmt: 'auto',
      q: 'auto',
      g: 'face',
      r: 'max',
    });
    expect(str).toBe('w_800,h_400,c_fill,f_auto,q_auto,g_face,r_max');
  });

  it('builds drop-in Cloudinary URLs', () => {
    const url = buildCloudinaryUrl({
      cloudName: 'demo-tenant',
      resourceType: 'image',
      publicId: 'folder/avatar',
      format: 'png',
      version: 1727400000,
      transform: { w: 300, h: 300, fit: 'cover', r: 'max' },
    });
    expect(url).toBe('/demo-tenant/image/upload/w_300,h_300,c_fill,r_max/v1727400000/folder/avatar.png');
  });
});
