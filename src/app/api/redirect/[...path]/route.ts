import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import { getVideoFromStorage } from '@/lib/storage';
import { transformImage } from '@/lib/image-processing';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import {
  isSignedDeliveryEnabled,
  verifySignedUrlToken,
} from '@/lib/signed-delivery';
import { recordImageDelivery } from '@/lib/delivery-analytics';
import { recordVideoDelivery } from '@/lib/delivery-analytics';
import { hasTransformParams } from '@/lib/utils';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

/**
 * GET /api/redirect/[...path]
 *
 * Keeps OLD Cloudinary URLs working after your Cloudinary account closes.
 * Point your old Cloudinary custom domain (CNAME) at this app, then rewrite
 * requests to this route. It understands Cloudinary URL paths:
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v1234/products/hero.jpg
 *   https://res.cloudinary.com/<cloud>/image/upload/w_800,h_600,q_70,f_auto/v1234/products/hero.jpg
 *
 * How to wire it (example — Cloudinary custom domain "images.example.com"):
 *
 *   next.config.ts rewrites (or Vercel rewrites / your reverse proxy):
 *     source: '/image/upload/:rest*'
 *     destination: '/api/redirect/image/upload/:rest*'
 *   then point the images.example.com CNAME at this app.
 *
 * Supported transform segments are translated to Storinary's transform
 * params: w_*, h_*, q_*, f_webp|jpeg|png|avif (f_auto → original), c_* fit,
 * g_auto attention cropping, brightness_*, contrast_*, and gamma_* mapping
 * (c_fill→cover, c_pad→contain, c_scale/c_limit→inside). Everything else
 * is ignored — best effort.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (isSignedDeliveryEnabled() && !verifySignedUrlToken(
    request.nextUrl.pathname.replace(/^\/api\/redirect\//, ''),
    request.nextUrl.searchParams.get('token')
  )) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const { path } = await context.params;
  const segments = (path as string[]).filter(Boolean);

  if (segments.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  // Strip the optional "image/upload" (or "image/fetch") prefix
  let rest = segments;
  if (
    rest.length >= 2 &&
    ['image', 'video'].includes(rest[0]) &&
    (rest[1] === 'upload' || rest[1] === 'fetch' || rest[1] === 'private')
  ) {
    rest = rest.slice(2);
  }

  const isVideo = segments[0] === 'video';

  // Only these are real Cloudinary transform prefixes. Whitelisting (instead
  // of matching any word_word segment) keeps ordinary public_ids like
  // "hero_image" or folders named "my_folder" from being eaten as transforms.
  const TRANSFORM_KEYS = new Set([
    'w', 'h', 'q', 'f', 'c', 'e', 'g', 'x', 'y', 'r', 'b', 'd', 'l', 't',
    'a', 'o', 'ar', 'brightness', 'contrast', 'gamma', 'dpr', 'fl', 'cs',
    'co', 'k', 'p', 'u',
  ]);

  // Split Cloudinary URL segments into transforms, version, and file path.
  // In canonical Cloudinary URLs the transforms and version always come
  // before the file path, so only the leading run is parsed as such.
  const transforms: Record<string, string> = {};
  const effects: string[] = [];
  const fileSegments: string[] = [];
  let inHead = true;
  let versionSeen = false;

  for (const rawSeg of rest) {
    // Cloudinary packs transforms into one comma-separated segment
    // (e.g. "w_100,h_100,q_70,f_auto") — split them apart first.
    for (const seg of rawSeg.split(',')) {
      if (!inHead) {
        fileSegments.push(seg);
        continue;
      }

      // v<number> = Cloudinary version segment → drop it. URLs carry exactly
      // one version, so only the first match is consumed — a folder that
      // happens to be named "v123" after the real version survives.
      if (!versionSeen && /^v\d+$/.test(seg)) {
        versionSeen = true;
        continue;
      }

      // Cloudinary transform segments look like w_800, h_600, q_70, f_auto…
      if (/^l_text:.+$/.test(seg)) {
        transforms.text = seg.slice(6)
          .split('_')
          .slice(2)
          .join(' ')
          .trim()
          .slice(0, 160);
        continue;
      }

      const m = seg.match(/^([a-z]{1,10})_([a-z0-9.]+)$/);
      if (m && TRANSFORM_KEYS.has(m[1]) && !seg.includes('.')) {
        const [, key, value] = m;
        switch (key) {
          case 'w':
            if (/^\d+$/.test(value)) transforms.w = value;
            break;
          case 'h':
            if (/^\d+$/.test(value)) transforms.h = value;
            break;
          case 'q':
            if (/^\d+$/.test(value)) transforms.q = value;
            break;
          case 'f':
            if (['auto', 'webp', 'jpeg', 'jpg', 'png', 'avif'].includes(value)) {
              transforms.fmt = value === 'jpg' ? 'jpeg' : value;
              if (value === 'auto') delete transforms.fmt;
            }
            break;
          case 'c':
            if (value === 'fill') transforms.fit = 'cover';
            else if (value === 'pad' || value === 'contain') transforms.fit = 'contain';
            else if (value === 'scale' || value === 'limit' || value === 'fit') {
              transforms.fit = 'inside';
            } else if (value === 'crop' || value === 'thumb') transforms.fit = 'cover';
            break;
          case 'g':
            if (['center', 'auto', 'north', 'south', 'east', 'west', 'face', 'faces'].includes(value)) {
              transforms.g = value;
            }
            break;
          case 'ar':
            if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) transforms.ar = value;
            break;
          case 'a':
            if (/^-?\d+$/.test(value)) transforms.a = value;
            break;
          case 'b':
            if (/^(?:rgb:[0-9a-f]{6}|[a-z]+)$/.test(value)) {
              transforms.b = value.startsWith('rgb:') ? `#${value.slice(4)}` : value;
            }
            break;
          case 'e':
            if (value === 'grayscale') effects.push('grayscale');
            else if (/^blur:\d+$/.test(value)) effects.push(`blur:${value.split(':')[1]}`);
            else if (/^saturation:-?\d+$/.test(value))
              effects.push(`saturation:${Math.max(0, Math.min(200, Number.parseInt(value.split(':')[1], 10)))}`);
            break;
          case 'dpr':
            if (/^\d+(?:\.\d+)?$/.test(value) && Number.parseFloat(value) >= 0.5) transforms.dpr = value;
            break;
          case 'brightness':
          case 'contrast':
          case 'gamma':
            if (/^\d+(?:\.\d+)?$/.test(value)) transforms[key] = value;
            break;
          default:
            // Known transform we don't support (effects, overlays…) → ignore
            break;
        }
        continue;
      }

      // First non-transform segment marks the start of the file path
      inHead = false;
      fileSegments.push(seg);
    }
  }

  if (effects.length) transforms.e = effects.join(',');

  if (fileSegments.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  // Rebuild the public_id (+ optional extension): "products/hero.jpg"
  const filePath = fileSegments.join('/');
  const dot = filePath.lastIndexOf('.');
  const hasExt = dot > filePath.lastIndexOf('/');
  const publicId = hasExt ? filePath.slice(0, dot) : filePath;
  const ext = hasExt ? filePath.slice(dot + 1).toLowerCase() : null;

  if (isVideo) {
    return serveCloudinaryVideo(request, {
      exactPath: ext ? `${publicId}.${ext}` : null,
      prefixPath: publicId,
      requestedRendition: request.nextUrl.searchParams.get('rendition'),
    });
  }

  // Look up the migrated image — exact match first, then any format
  let image = null;
  if (ext) {
    image = await prisma.image.findUnique({
      where: { storagePath: `${publicId}.${ext}` },
    });
  }
  if (!image) {
    image = await prisma.image.findFirst({
      where: { storagePath: { startsWith: `${publicId}.` } },
    });
  }

  if (!image) {
    return new Response('Not found', { status: 404 });
  }

  const parsedTransforms: TransformParams = {
    q: transforms.q === 'auto' ? 'auto' : undefined,
    ...transforms,
    e: transforms.e?.split(',').map((effect) => {
      if (effect === 'grayscale') return { grayscale: true };
      const [name, value] = effect.split(':');
      return { [name]: Number.parseInt(value, 10) };
    }),
  } as TransformParams;

  const deliveryMetadata = {
    imageId: image.id,
    kind: hasTransformParams(parsedTransforms) ? ('transform' as const) : ('original' as const),
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  };

  if (!hasTransformParams(parsedTransforms)) {
    try {
      const original = await getFromStorage(image.storagePath);
      void recordImageDelivery({ ...deliveryMetadata, bytes: original.buffer.length }).catch(() => {});
      return new Response(new Uint8Array(original.buffer), {
        headers: {
          'Content-Type': original.contentType,
          ...(isSignedDeliveryEnabled()
            ? { 'Cache-Control': 'private, no-store' }
            : { 'Cache-Control': 'public, max-age=31536000, immutable', 'CDN-Cache-Control': 'public, max-age=31536000, immutable' }),
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }

  const cacheKey = transformCacheKey(image.storagePath, parsedTransforms);
  const cached = transformCache.get(cacheKey);
  if (cached) {
    void recordImageDelivery({ ...deliveryMetadata, bytes: cached.buffer.length }).catch(() => {});
    return new Response(new Uint8Array(cached.buffer), {
      headers: { 'Content-Type': cached.contentType, ...(cacheHeaders()) },
    });
  }

  const diskCached = await diskCache.get(cacheKey);
  if (diskCached) {
    transformCache.set(cacheKey, diskCached);
    void recordImageDelivery({ ...deliveryMetadata, bytes: diskCached.buffer.length }).catch(() => {});
    return new Response(new Uint8Array(diskCached.buffer), {
      headers: { 'Content-Type': diskCached.contentType, ...(cacheHeaders()) },
    });
  }

  let fetched;
  try {
    fetched = await getFromStorage(image.storagePath);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  try {
    const result = await transformImage(fetched.buffer, parsedTransforms);
    const entry = { buffer: result.buffer, contentType: result.contentType };
    transformCache.set(cacheKey, entry);
    void diskCache.set(cacheKey, entry).catch(() => {});
    void recordImageDelivery({ ...deliveryMetadata, bytes: result.buffer.length }).catch(() => {});
    return new Response(new Uint8Array(result.buffer), {
      headers: { 'Content-Type': result.contentType, ...(cacheHeaders()) },
    });
  } catch {
    return new Response('Transform failed', { status: 500 });
  }
}

async function serveCloudinaryVideo(
  request: NextRequest,
  input: { exactPath: string | null; prefixPath: string; requestedRendition: string | null }
) {
  const video = await prisma.video.findFirst({
    where: input.exactPath ? { storagePath: input.exactPath } : undefined,
  });
  if (!video) return new Response('Not found', { status: 404 });

  let rendition = null;
  if (input.requestedRendition) {
    rendition = await prisma.videoRendition.findUnique({
      where: {
        videoId_label: { videoId: video.id, label: input.requestedRendition },
      },
    });
    if (!rendition) return new Response('Rendition not found', { status: 404 });
  }

  const storagePath = rendition?.storagePath ?? video.storagePath;
  const totalSize = rendition?.fileSize ?? video.fileSize;
  const contentType = rendition ? 'video/mp4' : video.mimeType;
  const deliveryMetadata = {
    videoId: video.id,
    label: rendition?.label || null,
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  };

  try {
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return new Response('Invalid Range', { status: 416 });
      const [startText, endText] = match.slice(1);
      let start = startText ? Number.parseInt(startText, 10) : 0;
      let end = endText
        ? Number.parseInt(endText, 10)
        : Math.min(start + 1024 * 1024 - 1, totalSize - 1);
      start = Math.max(0, start);
      end = Math.min(end, totalSize - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return rangeNotSatisfiable(totalSize);
      }

      const result = await getVideoFromStorage(storagePath, `bytes=${start}-${end}`);
      if (result.rangeStatus === 416) return rangeNotSatisfiable(result.totalSize || totalSize);
      void recordVideoDelivery({ ...deliveryMetadata, bytes: result.buffer.length }).catch(() => {});
      return videoResponse(new Uint8Array(result.buffer), {
        contentType: result.contentType,
        status: 206,
        totalSize: result.totalSize || totalSize,
        start,
        end,
      });
    }

    const result = await getVideoFromStorage(storagePath);
    void recordVideoDelivery({ ...deliveryMetadata, bytes: result.buffer.length }).catch(() => {});
    return videoResponse(new Uint8Array(result.buffer), { contentType: result.contentType || contentType });
  } catch {
    return new Response('Video unavailable', { status: 502 });
  }
}

function rangeNotSatisfiable(totalSize: number) {
  return new Response('Range not satisfiable', {
    status: 416,
    headers: { 'Content-Range': `bytes */${totalSize}` },
  });
}

function videoResponse(body: Uint8Array<ArrayBuffer>, options: {
  contentType?: string;
  status?: number;
  totalSize?: number;
  start?: number;
  end?: number;
}) {
  const headers = new Headers();
  headers.set('Content-Type', options.contentType || 'application/octet-stream');
  headers.set('Content-Length', String(body.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', isSignedDeliveryEnabled() ? 'private, no-store' : 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (options.status === 206 && options.start !== undefined && options.end !== undefined) {
    headers.set('Content-Range', `bytes ${options.start}-${options.end}/${options.totalSize}`);
  }
  return new Response(body, { status: options.status ?? 200, headers });
}

function cacheHeaders() {
  return isSignedDeliveryEnabled()
    ? {
        'Cache-Control': 'private, no-store',
        'CDN-Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      }
    : {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      };
}
