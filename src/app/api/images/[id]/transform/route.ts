import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import { transformImage } from '@/lib/image-processing';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { svgSafeResponseHeaders } from '@/lib/svg-security';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * GET /api/images/:id/transform?w=&h=&q=&fmt=&fit=
 * Apply transformations to an image and return the binary result.
 * Untransformed SVGs are served with hardening headers (attachment + sandbox)
 * so a malicious SVG cannot execute scripts on this origin.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) {
    return new Response('Not found', { status: 404 });
  }

  let overlayBuffer: Buffer | undefined;
  if (request.nextUrl.searchParams.has('overlay')) {
    const overlay = await prisma.image.findUnique({
      where: { id: request.nextUrl.searchParams.get('overlay') || '' },
      select: { storagePath: true },
    });
    if (!overlay) return new Response('Overlay not found', { status: 404 });
    try {
      overlayBuffer = (await getFromStorage(overlay.storagePath)).buffer;
    } catch {
      return new Response('Overlay unavailable', { status: 502 });
    }
  }

  const activeNamedTransforms = await prisma.namedTransformation.findMany({
    where: { active: true },
    select: { name: true, params: true },
  });
  const namedTransforms = Object.fromEntries(activeNamedTransforms.map((row) => [row.name, row.params]));

  const params = parseTransformParams(
    request.nextUrl.searchParams,
    namedTransforms
  ) as TransformParams;
  const hasTransforms = hasTransformParams(params);

  // Reuse a previously processed transform if we have one
  const cacheKey = hasTransforms ? transformCacheKey(image.storagePath, params) : '';

  // L1: in-memory LRU cache
  const cached = hasTransforms ? transformCache.get(cacheKey) : undefined;
  if (cached) {
    return new Response(new Uint8Array(cached.buffer), {
      headers: { 'Content-Type': cached.contentType, ...CACHE_HEADERS },
    });
  }

  // L2: disk-backed persistent cache (survives cold starts)
  if (hasTransforms) {
    const diskCached = await diskCache.get(cacheKey);
    if (diskCached) {
      transformCache.set(cacheKey, {
        buffer: diskCached.buffer,
        contentType: diskCached.contentType,
      });
      return new Response(new Uint8Array(diskCached.buffer), {
        headers: { 'Content-Type': diskCached.contentType, ...CACHE_HEADERS },
      });
    }
  }

  let fetched;
  try {
    fetched = await getFromStorage(image.storagePath);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // No transform params → serve the original file (hardened for SVGs)
  if (!hasTransforms) {
    const isSvg =
      image.format === 'svg' ||
      fetched.contentType === 'image/svg+xml' ||
      image.storagePath.toLowerCase().endsWith('.svg');
    const safeHeaders = isSvg ? svgSafeResponseHeaders() : {};
    return new Response(new Uint8Array(fetched.buffer), {
      headers: {
        'Content-Type': fetched.contentType,
        ...CACHE_HEADERS,
        ...safeHeaders,
      },
    });
  }

  let result;
  try {
    result = await transformImage(fetched.buffer, params, overlayBuffer);
  } catch {
    return new Response('Transform failed', { status: 500 });
  }

  const entry = {
    buffer: result.buffer,
    contentType: result.contentType,
  };

  // Store in both cache layers
  transformCache.set(cacheKey, entry);
  diskCache.set(cacheKey, entry).catch(() => {}); // fire-and-forget; best-effort

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.contentType,
      ...CACHE_HEADERS,
    },
  });
}
