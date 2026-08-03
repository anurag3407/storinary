import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, getPublicUrl } from '@/lib/storage';
import { transformImage } from '@/lib/image-processing';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { parseTransformParams } from '@/lib/utils';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

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
  const { path } = await context.params;
  const key = (path as string[]).join('/');

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const params = parseTransformParams(
    request.nextUrl.searchParams
  ) as TransformParams;
  const hasTransforms = Boolean(
    params.w || params.h || params.q || params.fmt || params.fit
  );

  // No transforms → hand off to the Supabase CDN directly
  if (!hasTransforms) {
    return NextResponse.redirect(getPublicUrl(key), 301);
  }

  // Reuse a previously processed transform if we have one
  const cacheKey = transformCacheKey(key, params);
  const cached = transformCache.get(cacheKey);
  if (cached) {
    return new Response(new Uint8Array(cached.buffer), {
      headers: { 'Content-Type': cached.contentType, ...CACHE_HEADERS },
    });
  }

  let fetched;
  try {
    fetched = await getFromStorage(key);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  let result;
  try {
    result = await transformImage(fetched.buffer, params);
  } catch {
    return new Response('Transform failed', { status: 500 });
  }

  transformCache.set(cacheKey, {
    buffer: result.buffer,
    contentType: result.contentType,
  });

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.contentType,
      ...CACHE_HEADERS,
    },
  });
}
