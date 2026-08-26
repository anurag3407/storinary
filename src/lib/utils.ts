import { nanoid } from 'nanoid';
import type { Image } from '@prisma/client';
import type {
  GeneratedLinks,
  ImageRecord,
  TransformEffect,
  TransformParams,
} from '@/types';

/**
 * Generate a short unique ID (8 characters).
 */
export function generateShortId(): string {
  return nanoid(8);
}

/**
 * Generate all link formats for an image.
 */
export function generateLinks(
  publicUrl: string,
  storagePath: string,
  altText: string,
  appUrl: string
): GeneratedLinks {
  const transformBase = `${appUrl}/api/serve/${storagePath}`;

  return {
    direct: publicUrl,
    directUrl: publicUrl,
    html: `<img src="${publicUrl}" alt="${altText || 'image'}" loading="lazy" />`,
    markdown: `![${altText || 'image'}](${publicUrl})`,
    css: `background-image: url('${publicUrl}');`,
    transformBase,
  };
}

/**
 * Serialize a Prisma Image row into the API-facing ImageRecord shape
 * (ISO-8601 strings for dates).
 */
export function serializeImage(image: Image): ImageRecord {
  const metadataValues = (
    image as typeof image & {
      metadata?: Array<{ field: { externalId: string }; value: string }>;
    }
  ).metadata;
  return {
    id: image.id,
    originalName: image.originalName,
    storagePath: image.storagePath,
    publicUrl: image.publicUrl,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    format: image.format,
    mimeType: image.mimeType,
    folder: image.folder,
    tags: image.tags,
    altText: image.altText,
    bgRemoved: image.bgRemoved,
    compressed: image.compressed,
    aiModerated: image.aiModerated,
    aiModerationScore: image.aiModerationScore,
    metadata: Object.fromEntries(
      (metadataValues ?? []).map((entry) => [entry.field.externalId, entry.value])
    ),
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

/**
 * Parse transform query parameters from URL search params.
 */
export function parseTransformParams(
  searchParams: URLSearchParams,
  namedTransforms: Record<string, string> = {}
): TransformParams {
  const params: Record<string, unknown> = {};

  const transformName = searchParams.get('t');
  if (transformName && namedTransforms[transformName]) {
    for (const [key, value] of new URLSearchParams(namedTransforms[transformName])) {
      if (!searchParams.has(key)) searchParams.set(key, value);
    }
  }

  const w = searchParams.get('w');
  if (w) params.w = Math.min(Math.max(parseInt(w, 10), 1), 8192);

  const h = searchParams.get('h');
  if (h) params.h = Math.min(Math.max(parseInt(h, 10), 1), 8192);

  const q = searchParams.get('q');
  if (q) params.q = q === 'auto' ? 'auto' : Math.min(Math.max(parseInt(q, 10) || 80, 1), 100);

  const fmt = searchParams.get('fmt');
  if (fmt && ['jpeg', 'webp', 'avif', 'png', 'auto'].includes(fmt)) {
    params.fmt = fmt;
  }

  const fit = searchParams.get('fit');
  if (
    fit &&
    ['cover', 'contain', 'fill', 'inside', 'outside', 'thumb', 'limit'].includes(fit)
  ) {
    params.fit = fit;
  }

  const gravity = searchParams.get('g');
  if (gravity && ['center', 'auto', 'north', 'south', 'east', 'west', 'face', 'faces'].includes(gravity)) {
    params.g = gravity as TransformParams['g'];
  }

  const aspectRatio = searchParams.get('ar');
  if (aspectRatio && /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(aspectRatio)) {
    params.ar = aspectRatio;
  }

  const background = searchParams.get('b');
  if (background && /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|[a-z]+)$/.test(background.toLowerCase())) {
    params.b = background;
  }

  const angle = searchParams.get('a');
  if (angle && /^-?\d+$/.test(angle)) params.a = Math.max(-360, Math.min(360, parseInt(angle, 10)));

  const effectsParam = searchParams.getAll('e').join(',');
  const effects: TransformEffect[] = [];
  for (const effect of effectsParam.split(',')) {
    const [name, rawValue] = effect.split(':');
    const value = Number.parseInt(rawValue || '', 10);
    if (name === 'grayscale') effects.push({ grayscale: true });
    else if (name === 'sepia') effects.push({ sepia: clampEffectValue(value, 0, 100, 70) });
    else if (name === 'blur') effects.push({ blur: clampEffectValue(value, 1, 1000, 50) });
    else if (name === 'sharpen') effects.push({ sharpen: clampEffectValue(value, 1, 100, 25) });
    else if (name === 'saturation')
      effects.push({ saturation: clampEffectValue(value ?? 100, 0, 200, 100) / 100 });
  }
  if (effects.length) params.e = effects;

  const brightness = parseEffectNumber(searchParams.get('brightness'), 0.1, 3, 1);
  if (brightness !== 1) params.brightness = brightness;
  const contrast = parseEffectNumber(searchParams.get('contrast'), 0.1, 3, 1);
  if (contrast !== 1) params.contrast = contrast;
  const gamma = parseEffectNumber(searchParams.get('gamma'), 0.1, 3, 1);
  if (gamma !== 1) params.gamma = gamma;

  const dpr = searchParams.get('dpr');
  if (dpr === 'auto') {
    params.dpr = 2;
  } else if (dpr && /^\d+(?:\.\d+)?$/.test(dpr)) {
    const value = Number.parseFloat(dpr);
    params.dpr = Math.min(Math.max(value, 0.5), 4);
  }

  const overlayText = searchParams.get('text');
  if (overlayText) {
    const clean = overlayText.trim().slice(0, 160).replace(/[\p{C}]/gu, '');
    if (clean) params.text = clean;
  }

  const overlayId = searchParams.get('overlay');
  if (overlayId && /^[a-zA-Z0-9_-]{1,64}$/.test(overlayId)) {
    params.overlayId = overlayId;
  }

  return params as TransformParams;
}

export function hasTransformParams(params: TransformParams): boolean {
  return Boolean(
    params.w ||
      params.h ||
      params.q ||
      (params.fmt && params.fmt !== 'auto') ||
      params.fit ||
      params.g ||
      params.ar ||
      params.b ||
      typeof params.a === 'number' ||
      params.e?.length ||
      params.brightness !== undefined ||
      params.contrast !== undefined ||
      params.gamma !== undefined ||
      params.dpr ||
      params.text ||
      params.overlayId
  );
}

function clampEffectValue(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function parseEffectNumber(raw: string | null, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  return clampEffectValue(Number.parseFloat(raw), min, max, fallback);
}

/**
 * Build a URL for the on-the-fly transform endpoint for a storage path.
 * Falls back to a relative URL when NEXT_PUBLIC_APP_URL is unset.
 */
export function generateServeUrl(
  storagePath: string,
  params?: Partial<TransformParams>
): string {
  const cleanPath = storagePath.replace(/^\//, '');
  const prefix = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL || '');
  const base = `${prefix}/api/serve/${cleanPath}`;
  if (!params) return base;

  const qs = new URLSearchParams();
  if (params.w) qs.set('w', String(params.w));
  if (params.h) qs.set('h', String(params.h));
  if (params.q) qs.set('q', String(params.q));
  if (params.fmt) qs.set('fmt', params.fmt);
  if (params.fit) qs.set('fit', params.fit);
  if (params.g) qs.set('g', params.g);
  if (params.ar) qs.set('ar', params.ar);
  if (params.b) qs.set('b', params.b);
  if (typeof params.a === 'number') qs.set('a', String(params.a));
  if (params.e?.length) {
    for (const effect of params.e) {
      if (effect.grayscale) qs.append('e', 'grayscale');
      else if (effect.sepia !== undefined) qs.append('e', `sepia:${effect.sepia}`);
      else if (effect.blur !== undefined) qs.append('e', `blur:${effect.blur}`);
      else if (effect.sharpen !== undefined) qs.append('e', `sharpen:${effect.sharpen}`);
      else if (effect.saturation !== undefined) {
        qs.append('e', `saturation:${Math.round(effect.saturation * 100)}`);
      }
    }
  }
  if (params.dpr) qs.set('dpr', String(params.dpr));
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Get MIME type from file extension.
 */
export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
