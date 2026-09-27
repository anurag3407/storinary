import { NextRequest } from 'next/server';
import { getFromStorage } from '@/lib/storage';
import { negotiateFormat, negotiateQuality, transformImage } from '@/lib/image-processing';
import { parseCloudinaryPath } from '@/lib/cloudinary-syntax';
import {
  transformCache,
  transformCacheKey,
  computeEtag,
  isNotModified,
  createNotModifiedResponse,
  coalesceTransform,
} from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { isSignedDeliveryEnabled, verifySignedUrlToken } from '@/lib/signed-delivery';
import { prisma } from '@/lib/prisma';
import { resolveTenantFromPath } from '@/lib/tenant';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import { recordImageDelivery } from '@/lib/delivery-analytics';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
};

const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
};

function cacheHeaders() {
  return isSignedDeliveryEnabled() ? PRIVATE_CACHE_HEADERS : PUBLIC_CACHE_HEADERS;
}

/**
 * GET /api/serve/[...path]?w=&h=&q=&fmt=&fit=
 * Direct CDN delivery & on-the-fly transformations via URL path or query params.
 * 
 * Supports both:
 * 1. Query parameters: /api/serve/folder/image.jpg?w=500&fit=cover
 * 2. Cloudinary path syntax: /api/serve/w_500,h_300,c_fill,f_auto,q_auto/folder/image.jpg
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const rawSegments = (path as string[]) || [];

  // Parse Cloudinary-style transformation path segments if present
  const { transformParams: pathTransforms, storagePath: parsedStoragePath } =
    parseCloudinaryPath(rawSegments);

  let key = parsedStoragePath || rawSegments.join('/');
  try {
    key = decodeURIComponent(key);
  } catch {
    // leave as key
  }
  key = key.replace(/^\//, '');

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const tenantId = await resolveTenantFromPath(key);
    return await runWithTenantScope(tenantId, async () => {
  if (isSignedDeliveryEnabled() && !verifySignedUrlToken(key, request.nextUrl.searchParams.get('token'))) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const activeNamedTransforms = await prisma.namedTransformation.findMany({
    where: { active: true },
    select: { name: true, params: true },
  });
  const namedTransforms = Object.fromEntries(activeNamedTransforms.map((row) => [row.name, row.params]));
  const queryParams = parseTransformParams(
    request.nextUrl.searchParams,
    namedTransforms
  ) as TransformParams;

  // Merge path-based Cloudinary transforms with query parameters (query params take priority)
  const params: TransformParams = {
    ...pathTransforms,
    ...queryParams,
    ...(pathTransforms.e || queryParams.e
      ? { e: [...(pathTransforms.e || []), ...(queryParams.e || [])] }
      : {}),
  };
  const hasTransforms = hasTransformParams(params);

  // ─── 1. SERVE ORIGINAL DIRECTLY (No Redirects) ───────────────
  if (!hasTransforms) {
    const origCacheKey = `orig:${key}`;

    // L1 Cache
    const cached = transformCache.get(origCacheKey);
    if (cached) {
      const etag = cached.etag || computeEtag(cached.buffer);
      if (isNotModified(request, etag)) {
        return createNotModifiedResponse(etag, {
          ...cacheHeaders(),
          'X-Storinary-Cache': 'HIT (Memory L1)',
          'X-Cache': 'HIT',
        });
      }
      void recordImageDelivery({
        imageId: cached.imageId || key,
        kind: 'original',
        cacheStatus: 'hit:memory',
        bytes: cached.buffer.length,
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});
      return new Response(new Uint8Array(cached.buffer), {
        headers: {
          'Content-Type': cached.contentType,
          ETag: etag,
          ...cacheHeaders(),
          'X-Storinary-Cache': 'HIT (Memory L1)',
          'X-Cache': 'HIT',
        },
      });
    }

    // L2 Cache
    const diskCached = await diskCache.get(origCacheKey);
    if (diskCached) {
      const etag = diskCached.etag || computeEtag(diskCached.buffer);
      transformCache.set(origCacheKey, {
        buffer: diskCached.buffer,
        contentType: diskCached.contentType,
        etag,
        imageId: diskCached.imageId,
        originalName: diskCached.originalName,
      });
      if (isNotModified(request, etag)) {
        return createNotModifiedResponse(etag, {
          ...cacheHeaders(),
          'X-Storinary-Cache': 'HIT (Disk L2)',
          'X-Cache': 'HIT',
        });
      }
      void recordImageDelivery({
        imageId: diskCached.imageId || key,
        kind: 'original',
        cacheStatus: 'hit:disk',
        bytes: diskCached.buffer.length,
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});
      return new Response(new Uint8Array(diskCached.buffer), {
        headers: {
          'Content-Type': diskCached.contentType,
          ETag: etag,
          ...cacheHeaders(),
          'X-Storinary-Cache': 'HIT (Disk L2)',
          'X-Cache': 'HIT',
        },
      });
    }

    let fetched;
    try {
      fetched = await getFromStorage(key);
    } catch {
      return new Response('Not found', { status: 404 });
    }

    const original = await prisma.image.findUnique({
      where: { storagePath: key },
      select: { id: true, originalName: true },
    }).catch(() => null);

    const etag = computeEtag(fetched.buffer);
    const entry = {
      buffer: fetched.buffer,
      contentType: fetched.contentType,
      etag,
      imageId: original?.id,
      originalName: original?.originalName,
    };
    transformCache.set(origCacheKey, entry);
    diskCache.set(origCacheKey, entry).catch(() => {});

    if (isNotModified(request, etag)) {
      return createNotModifiedResponse(etag, {
        ...cacheHeaders(),
        'X-Storinary-Cache': 'MISS (Storage Origin)',
        'X-Cache': 'MISS',
      });
    }

    void recordImageDelivery({
      imageId: original?.id || key,
      kind: 'original',
      cacheStatus: 'miss',
      bytes: fetched.buffer.length,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    return new Response(new Uint8Array(fetched.buffer), {
      headers: {
        'Content-Type': fetched.contentType,
        ETag: etag,
        ...cacheHeaders(),
        'X-Storinary-Cache': 'MISS (Storage Origin)',
        'X-Cache': 'MISS',
      },
    });
  }

  // ─── 2. SERVE ON-THE-FLY TRANSFORMS ─────────────────────────
  const image = await prisma.image.findUnique({
    where: { storagePath: key },
    select: { id: true, fileSize: true, originalName: true },
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

  const acceptHeader = request.headers.get('accept');
  const isAutoFormat = !params.fmt || params.fmt === 'auto';
  const effectiveFormat = isAutoFormat ? negotiateFormat(acceptHeader, params.fmt) : params.fmt;
  const effectiveQuality = negotiateQuality(params.q, effectiveFormat);

  // Cache key includes effective format & quality so AVIF / WebP / JPEG variants are cached distinctly
  const cacheParams: TransformParams = { ...params, fmt: effectiveFormat, q: effectiveQuality };
  const cacheKey = transformCacheKey(key, cacheParams);
  const varyHeader: Record<string, string> = isAutoFormat ? { Vary: 'Accept' } : {};

  // L1: in-memory LRU cache
  const cached = transformCache.get(cacheKey);
  if (cached) {
    const etag = cached.etag || computeEtag(cached.buffer);
    if (isNotModified(request, etag)) {
      return createNotModifiedResponse(etag, {
        ...cacheHeaders(),
        ...varyHeader,
        'X-Storinary-Cache': 'HIT (Transform L1)',
        'X-Cache': 'HIT',
      });
    }
    void recordImageDelivery({
      imageId: image.id,
      kind: 'transform',
      cacheStatus: 'hit:memory',
      bytes: cached.buffer.length,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});
    return new Response(new Uint8Array(cached.buffer), {
      headers: {
        'Content-Type': cached.contentType,
        ETag: etag,
        ...cacheHeaders(),
        ...varyHeader,
        'X-Storinary-Cache': 'HIT (Transform L1)',
        'X-Cache': 'HIT',
      },
    });
  }

  // L2: disk-backed persistent cache (survives cold starts)
  const diskCached = await diskCache.get(cacheKey);
  if (diskCached) {
    const etag = diskCached.etag || computeEtag(diskCached.buffer);
    transformCache.set(cacheKey, {
      buffer: diskCached.buffer,
      contentType: diskCached.contentType,
      etag,
      imageId: image.id,
      originalName: image.originalName,
    });
    if (isNotModified(request, etag)) {
      return createNotModifiedResponse(etag, {
        ...cacheHeaders(),
        ...varyHeader,
        'X-Storinary-Cache': 'HIT (Transform L2)',
        'X-Cache': 'HIT',
      });
    }
    void recordImageDelivery({
      imageId: image.id,
      kind: 'transform',
      cacheStatus: 'hit:disk',
      bytes: diskCached.buffer.length,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});
    return new Response(new Uint8Array(diskCached.buffer), {
      headers: {
        'Content-Type': diskCached.contentType,
        ETag: etag,
        ...cacheHeaders(),
        ...varyHeader,
        'X-Storinary-Cache': 'HIT (Transform L2)',
        'X-Cache': 'HIT',
      },
    });
  }

  let resultEntry: { buffer: Buffer; contentType: string; etag: string };
  try {
    resultEntry = await coalesceTransform(cacheKey, async () => {
      const result = await transformImage(fetched.buffer, params, overlayBuffer || undefined, acceptHeader);
      const etag = computeEtag(result.buffer);
      const entry = {
        buffer: result.buffer,
        contentType: result.contentType,
        etag,
        imageId: image.id,
        originalName: image.originalName,
      };
      transformCache.set(cacheKey, entry);
      diskCache.set(cacheKey, entry).catch(() => {});
      return entry;
    });
  } catch {
    return new Response('Transform failed', { status: 500 });
  }

  if (isNotModified(request, resultEntry.etag)) {
    return createNotModifiedResponse(resultEntry.etag, {
      ...cacheHeaders(),
      ...varyHeader,
      'X-Storinary-Cache': 'MISS (Sharp Fresh)',
      'X-Cache': 'MISS',
    });
  }

  void recordImageDelivery({
    imageId: image.id,
    kind: 'transform',
    cacheStatus: 'miss',
    bytes: resultEntry.buffer.length,
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  }).catch(() => {});

  return new Response(new Uint8Array(resultEntry.buffer), {
    headers: {
      'Content-Type': resultEntry.contentType,
      ETag: resultEntry.etag,
      ...cacheHeaders(),
      ...varyHeader,
      'X-Storinary-Cache': 'MISS (Sharp Fresh)',
      'X-Cache': 'MISS',
    },
  });
    });
  } catch (error) {
    return new Response('Not found', { status: error instanceof Error && 'status' in error ? Number((error as { status: number }).status) : 404 });
  }
}