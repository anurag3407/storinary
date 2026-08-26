import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import { transformImage } from '@/lib/image-processing';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { isSignedDeliveryEnabled, verifySignedUrlToken } from '@/lib/signed-delivery';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import { recordVideoDelivery } from '@/lib/delivery-analytics';
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

function deliveryMetadata(request: NextRequest) {
  return {
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const video = await prisma.video.findUnique({
    where: { id },
    select: { posterPath: true },
  });
  if (!video?.posterPath) return new Response('Not found', { status: 404 });

  if (
    isSignedDeliveryEnabled() &&
    !verifySignedUrlToken(video.posterPath, request.nextUrl.searchParams.get('token'))
  ) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const activeNamedTransforms = await prisma.namedTransformation.findMany({
    where: { active: true },
    select: { name: true, params: true },
  });
  const namedTransforms = Object.fromEntries(
    activeNamedTransforms.map((row) => [row.name, row.params])
  );
  const params = parseTransformParams(
    request.nextUrl.searchParams,
    namedTransforms
  ) as TransformParams;
  const hasTransforms = hasTransformParams(params);
  const metadata = deliveryMetadata(request);

  if (!hasTransforms && isSignedDeliveryEnabled()) {
    return new Response('Not found', { status: 404 });
  }
  if (!hasTransforms) {
    void recordVideoDelivery({ videoId: id, ...metadata }).catch(() => {});
  }

  const cacheKey = hasTransforms ? transformCacheKey(video.posterPath, params) : '';
  const cached = hasTransforms ? transformCache.get(cacheKey) : undefined;
  if (cached) {
    void recordVideoDelivery({
      videoId: id,
      label: 'poster-transform',
      bytes: cached.buffer.length,
      ...metadata,
    }).catch(() => {});
    return new Response(new Uint8Array(cached.buffer), {
      headers: { 'Content-Type': cached.contentType, ...cacheHeaders() },
    });
  }

  if (hasTransforms) {
    const diskCached = await diskCache.get(cacheKey);
    if (diskCached) {
      transformCache.set(cacheKey, {
        buffer: diskCached.buffer,
        contentType: diskCached.contentType,
      });
      void recordVideoDelivery({
        videoId: id,
        label: 'poster-transform',
        bytes: diskCached.buffer.length,
        ...metadata,
      }).catch(() => {});
      return new Response(new Uint8Array(diskCached.buffer), {
        headers: { 'Content-Type': diskCached.contentType, ...cacheHeaders() },
      });
    }
  }

  let image;
  try {
    image = await getFromStorage(video.posterPath);
    if (hasTransforms) {
      const result = await transformImage(image.buffer, params);
      const entry = { buffer: result.buffer, contentType: result.contentType };
      transformCache.set(cacheKey, entry);
      diskCache.set(cacheKey, entry).catch(() => {});
      void recordVideoDelivery({
        videoId: id,
        label: 'poster-transform',
        bytes: result.buffer.length,
        ...metadata,
      }).catch(() => {});

      return new Response(new Uint8Array(result.buffer), {
        headers: { 'Content-Type': result.contentType, ...cacheHeaders() },
      });
    }

    return new Response(new Uint8Array(image.buffer), {
      headers: {
        'Content-Type': image.contentType || 'image/webp',
        'Content-Length': String(image.buffer.length),
        ...cacheHeaders(),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(hasTransforms ? 'Not found' : 'Poster unavailable', {
      status: hasTransforms ? 404 : 502,
    });
  }
}
