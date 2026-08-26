import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, getPublicUrl } from '@/lib/storage';
import { transformImage } from '@/lib/image-processing';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { isSignedDeliveryEnabled, verifySignedUrlToken } from '@/lib/signed-delivery';
import { prisma } from '@/lib/prisma';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import { recordImageDelivery } from '@/lib/delivery-analytics';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

function cacheHeaders() {
  return isSignedDeliveryEnabled() ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS;
}

/**
 * GET /api/serve/[...path]?w=&h=&q=&fmt=&fit=
 * On-the-fly transformations via URL path. The catch-all captures the
 * Supabase Storage path (e.g. /api/serve/2024/08/photo-abc12345.webp).
 *
 * Without transform params → 301 redirect to the public CDN URL.
 * With transform params → process with sharp (cached in memory) and return
 * the binary.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const activeNamedTransforms = await prisma.namedTransformation.findMany({
    where: { active: true },
    select: { name: true, params: true },
  });
  const namedTransforms = Object.fromEntries(activeNamedTransforms.map((row) => [row.name, row.params]));

  const { path } = await context.params;
  const rawKey = (path as string[] || []).join('/');
  let key = rawKey;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    // leave as rawKey
  }
  key = key.replace(/^\//, '');

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  if (isSignedDeliveryEnabled() && !verifySignedUrlToken(key, request.nextUrl.searchParams.get('token'))) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const params = parseTransformParams(
    request.nextUrl.searchParams,
    namedTransforms
  ) as TransformParams;
  const hasTransforms = hasTransformParams(params);

  if (!hasTransforms) {
    if (isSignedDeliveryEnabled()) return new Response('Not found', { status: 404 });
    const original = await prisma.image.findUnique({
      where: { storagePath: key },
      select: { id: true },
    });
    void recordImageDelivery({
      imageId: original?.id || '',
      kind: 'original',
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});
    return NextResponse.redirect(getPublicUrl(key), 301);
  }

  const image = await prisma.image.findUnique({
    where: { storagePath: key },
    select: { id: true, fileSize: true },
  });
  if (!image) return new Response('Not found', { status: 404 });

  let fetched;
  try {
    fetched = await getFromStorage(key);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  let overlayBuffer: Buffer | null = null;
  if (params.overlayId) {
    const overlay = await prisma.image.findUnique({
      where: { id: params.overlayId },
      select: { storagePath: true },
    });
    if (!overlay) return new Response('Overlay not found', { status: 404 });
    try {
      overlayBuffer = (await getFromStorage(overlay.storagePath)).buffer;
    } catch {
      return new Response('Overlay unavailable', { status: 502 });
    }
  }

  // Reuse a previously processed transform if we have one
  const cacheKey = transformCacheKey(key, params);

  // L1: in-memory LRU cache
  const cached = transformCache.get(cacheKey);
  if (cached) {
    void recordImageDelivery({
      imageId: image.id,
      kind: 'transform',
      bytes: cached.buffer.length,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});
    return new Response(new Uint8Array(cached.buffer), {
      headers: { 'Content-Type': cached.contentType, ...cacheHeaders() },
    });
  }

  // L2: disk-backed persistent cache (survives cold starts)
  const diskCached = await diskCache.get(cacheKey);
  if (diskCached) {
    void recordImageDelivery({
      imageId: image.id,
      kind: 'transform',
      bytes: diskCached.buffer.length,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});
    // Promote to in-memory cache
    transformCache.set(cacheKey, {
      buffer: diskCached.buffer,
      contentType: diskCached.contentType,
    });
    return new Response(new Uint8Array(diskCached.buffer), {
      headers: { 'Content-Type': diskCached.contentType, ...cacheHeaders() },
    });
  }

  let result;
  try {
    result = await transformImage(fetched.buffer, params, overlayBuffer || undefined);
  } catch {
    return new Response('Transform failed', { status: 500 });
  }

  const entry = {
    buffer: result.buffer,
    contentType: result.contentType,
  };
  void recordImageDelivery({
    imageId: image.id,
    kind: 'transform',
    bytes: result.buffer.length,
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  }).catch(() => {});

  // Store in both cache layers
  transformCache.set(cacheKey, entry);
  diskCache.set(cacheKey, entry).catch(() => {}); // fire-and-forget; best-effort

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.contentType,
      ...cacheHeaders(),
    },
  });
}
