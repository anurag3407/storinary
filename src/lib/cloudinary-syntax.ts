import type { TransformEffect, TransformGravity, TransformParams } from '@/types';

/**
 * Recognizes Cloudinary-style single transformation tokens like:
 * w_500, h_300, c_fill, f_auto, q_auto:good, g_face, ar_16:9, a_90,
 * b_white, dpr_2, e_blur:100, u_logo123, t_thumb, r_max, r_20
 */
const CLOUDINARY_TOKEN_REGEX =
  /^(?:[whcqfgebar]|ar|dpr|u|t)_[a-zA-Z0-9:._#-]+$/;

/**
 * Checks if a path segment represents a Cloudinary transformation block.
 * e.g., "w_500,h_300,c_fill" or "e_blur:200" or "r_max"
 */
export function isCloudinaryTransformSegment(segment: string): boolean {
  if (!segment || segment.includes('/') || segment.includes('.')) return false;
  const tokens = segment.split(',');
  if (tokens.length === 0) return false;
  return tokens.every((token) => CLOUDINARY_TOKEN_REGEX.test(token.trim()));
}

/**
 * Parse a single Cloudinary transformation token into partial TransformParams.
 */
export function parseCloudinaryToken(
  token: string,
  params: Partial<TransformParams>
): void {
  const trimmed = token.trim();
  const underscoreIdx = trimmed.indexOf('_');
  if (underscoreIdx === -1) return;

  const key = trimmed.slice(0, underscoreIdx);
  const value = trimmed.slice(underscoreIdx + 1);

  switch (key) {
    case 'w': {
      const num = parseInt(value, 10);
      if (num > 0) params.w = Math.min(num, 8192);
      break;
    }
    case 'h': {
      const num = parseInt(value, 10);
      if (num > 0) params.h = Math.min(num, 8192);
      break;
    }
    case 'c': {
      // Cloudinary crop/fit modes
      const cropMap: Record<string, TransformParams['fit']> = {
        fill: 'cover',
        crop: 'cover',
        thumb: 'thumb',
        fit: 'inside',
        scale: 'inside',
        limit: 'limit',
        pad: 'contain',
        fill_pad: 'contain',
      };
      if (cropMap[value]) params.fit = cropMap[value];
      break;
    }
    case 'f': {
      // Cloudinary format
      if (value === 'auto') params.fmt = 'auto';
      else if (['webp', 'avif', 'png'].includes(value)) {
        params.fmt = value as TransformParams['fmt'];
      } else if (value === 'jpg' || value === 'jpeg') {
        params.fmt = 'jpeg';
      }
      break;
    }
    case 'q': {
      // Cloudinary quality
      if (value === 'auto' || value.startsWith('auto:')) {
        params.q = 'auto';
      } else {
        const num = parseInt(value, 10);
        if (!isNaN(num)) params.q = Math.min(Math.max(num, 1), 100);
      }
      break;
    }
    case 'g': {
      // Cloudinary gravity
      const gravityMap: Record<string, TransformGravity> = {
        center: 'center',
        centre: 'center',
        auto: 'auto',
        face: 'face',
        faces: 'faces',
        north: 'north',
        south: 'south',
        east: 'east',
        west: 'west',
        north_east: 'north',
        north_west: 'north',
        south_east: 'south',
        south_west: 'south',
      };
      if (gravityMap[value]) params.g = gravityMap[value];
      break;
    }
    case 'ar': {
      if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) {
        params.ar = value;
      }
      break;
    }
    case 'a': {
      const deg = parseInt(value, 10);
      if (!isNaN(deg)) params.a = Math.max(-360, Math.min(360, deg));
      break;
    }
    case 'b': {
      // Background color: b_white, b_rgb:ffffff, b_#ffffff
      const cleanColor = value.replace(/^rgb:/i, '#');
      if (/^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|[a-z]+)$/i.test(cleanColor)) {
        params.b = cleanColor;
      }
      break;
    }
    case 'dpr': {
      if (value === 'auto') params.dpr = 2;
      else {
        const d = parseFloat(value);
        if (!isNaN(d)) params.dpr = Math.min(Math.max(d, 0.5), 4);
      }
      break;
    }
    case 'e': {
      // Cloudinary effects
      const [effectName, effectVal] = value.split(':');
      const valNum = effectVal ? parseInt(effectVal, 10) : undefined;
      const effectList: TransformEffect[] = params.e ? [...params.e] : [];

      if (effectName === 'grayscale' || effectName === 'greyscale') {
        effectList.push({ grayscale: true });
      } else if (effectName === 'sepia') {
        effectList.push({ sepia: valNum ?? 70 });
      } else if (effectName === 'blur') {
        effectList.push({ blur: valNum ?? 50 });
      } else if (effectName === 'sharpen') {
        effectList.push({ sharpen: valNum ?? 25 });
      } else if (effectName === 'saturation') {
        effectList.push({ saturation: (valNum ?? 100) / 100 });
      }
      if (effectList.length) params.e = effectList;
      break;
    }
    case 'u': {
      // Overlay image id (Cloudinary underlay/overlay public_id)
      if (/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
        params.overlayId = value;
      }
      break;
    }
    case 't': {
      // Named transformation
      params.t = value;
      break;
    }
    case 'r': {
      // Corner radius: r_max or r_20
      if (value === 'max' || /^\d+$/.test(value)) {
        params.r = value;
      }
      break;
    }
  }
}

/**
 * Parses Cloudinary-style transformation path segments from a URL path.
 *
 * Example input:
 *   ['w_500,h_300,c_fill', 'r_max', 'v1727400000', '2026', '09', 'photo.jpg']
 * Output:
 *   {
 *     transformParams: { w: 500, h: 300, fit: 'cover', r: 'max' },
 *     storagePath: '2026/09/photo.jpg'
 *   }
 */
export function parseCloudinaryPath(pathSegments: string[]): {
  transformParams: Partial<TransformParams>;
  storagePath: string;
} {
  const transformParams: Partial<TransformParams> = {};
  let storageStartIndex = 0;

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    // Strip Cloudinary version tag like v123456789
    if (/^v\d+$/.test(segment)) {
      storageStartIndex = i + 1;
      continue;
    }
    if (isCloudinaryTransformSegment(segment)) {
      const tokens = segment.split(',');
      for (const token of tokens) {
        parseCloudinaryToken(token, transformParams);
      }
      storageStartIndex = i + 1;
    } else {
      break;
    }
  }

  // If next segment is a version segment, skip it
  if (storageStartIndex < pathSegments.length && /^v\d+$/.test(pathSegments[storageStartIndex])) {
    storageStartIndex++;
  }

  const storagePath = pathSegments.slice(storageStartIndex).join('/');
  return { transformParams, storagePath };
}

/**
 * Builds a Cloudinary-compatible transformation string from TransformParams.
 *
 * Example:
 *   buildCloudinaryTransformString({ w: 500, h: 300, fit: 'cover', fmt: 'auto', q: 'auto', r: 'max' })
 *   -> "w_500,h_300,c_fill,f_auto,q_auto,r_max"
 */
export function buildCloudinaryTransformString(
  params: Partial<TransformParams>
): string {
  const parts: string[] = [];

  if (params.w) parts.push(`w_${params.w}`);
  if (params.h) parts.push(`h_${params.h}`);

  if (params.fit) {
    const reverseCropMap: Record<string, string> = {
      cover: 'c_fill',
      inside: 'c_fit',
      contain: 'c_pad',
      fill: 'c_fill',
      thumb: 'c_thumb',
      limit: 'c_limit',
    };
    parts.push(reverseCropMap[params.fit] || `c_${params.fit}`);
  }

  if (params.fmt) parts.push(`f_${params.fmt}`);
  if (params.q) parts.push(`q_${params.q}`);

  if (params.g) parts.push(`g_${params.g}`);
  if (params.ar) parts.push(`ar_${params.ar}`);
  if (params.a !== undefined) parts.push(`a_${params.a}`);
  if (params.b) parts.push(`b_${params.b.replace('#', 'rgb:')}`);
  if (params.dpr) parts.push(`dpr_${params.dpr}`);
  if (params.r) parts.push(`r_${params.r}`);

  if (params.e) {
    for (const eff of params.e) {
      if (eff.grayscale) parts.push('e_grayscale');
      if (eff.sepia !== undefined) parts.push(`e_sepia:${eff.sepia}`);
      if (eff.blur !== undefined) parts.push(`e_blur:${eff.blur}`);
      if (eff.sharpen !== undefined) parts.push(`e_sharpen:${eff.sharpen}`);
      if (eff.saturation !== undefined) parts.push(`e_saturation:${Math.round(eff.saturation * 100)}`);
    }
  }

  if (params.overlayId) parts.push(`u_${params.overlayId}`);
  if (params.t) parts.push(`t_${params.t}`);

  return parts.join(',');
}

export interface CloudinaryUrlOptions {
  cloudName: string;
  resourceType?: 'image' | 'video';
  publicId: string;
  version?: number | string;
  format?: string;
  transform?: Partial<TransformParams>;
  origin?: string;
}

/**
 * Builds a drop-in Cloudinary-compatible URL.
 * e.g. /<cloudName>/image/upload/w_500,c_fill,r_max/v1234/sample.jpg
 */
export function buildCloudinaryUrl(options: CloudinaryUrlOptions): string {
  const {
    cloudName,
    resourceType = 'image',
    publicId,
    version,
    format,
    transform,
    origin = '',
  } = options;

  const parts: string[] = [cloudName, resourceType, 'upload'];

  if (transform && Object.keys(transform).length > 0) {
    const transformStr = buildCloudinaryTransformString(transform);
    if (transformStr) parts.push(transformStr);
  }

  if (version) {
    parts.push(typeof version === 'string' && version.startsWith('v') ? version : `v${version}`);
  }

  let finalId = publicId.replace(/^\//, '');
  if (format && !finalId.endsWith(`.${format}`)) {
    finalId = `${finalId}.${format}`;
  }
  parts.push(finalId);

  const path = `/${parts.join('/')}`;
  return origin ? `${origin.replace(/\/$/, '')}${path}` : path;
}
