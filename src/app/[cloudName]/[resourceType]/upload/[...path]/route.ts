import { NextRequest, NextResponse } from 'next/server';
import { prisma, rawPrisma } from '@/lib/prisma';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { getFromStorage, getVideoFromStorage } from '@/lib/storage';
import { negotiateFormat, negotiateQuality, transformImage } from '@/lib/image-processing';
import { parseCloudinaryPath } from '@/lib/cloudinary-syntax';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { isSignedDeliveryEnabled, verifySignedUrlToken } from '@/lib/signed-delivery';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import { recordImageDelivery, recordVideoDelivery } from '@/lib/delivery-analytics';
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
 * Cloudinary-compatible delivery router:
 * GET /:cloudName/(image|video)/upload/(<transformations>/)*(v<version>/)?<public_id>(.<format>)?
 *
 * Examples:
 *   GET /demo/image/upload/w_500,h_300,c_fill,f_auto,q_auto/sample.jpg
 *   GET /demo/image/upload/w_200,h_200,c_fill,r_max/v123456789/avatar.png
 *   GET /demo/video/upload/so_3.5/movie.jpg (video poster snapshot)
 *   GET /demo/video/upload/movie.mp4 (video streaming)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cloudName: string; resourceType: string; path: string[] }> }
) {
  const { cloudName, resourceType, path } = await context.params;

  if (resourceType !== 'image' && resourceType !== 'video') {
    return new Response('Unsupported resource type', { status: 404 });
  }

  // Look up organization by cloudName (slug)
  const orgLookup = rawPrisma?.organization?.findUnique
    ? rawPrisma.organization.findUnique
    : prisma.organization.findUnique;

  const org = await orgLookup({
    where: { slug: cloudName },
    select: { id: true, slug: true },
  });

  if (!org) {
    return new Response('Cloud name not found', { status: 404 });
  }

  return runWithTenantScope(org.id, async () => {
    const rawSegments = path || [];
    const { transformParams: pathTransforms, storagePath: parsedStoragePath } =
      parseCloudinaryPath(rawSegments);

    let key = parsedStoragePath || rawSegments.join('/');
    try {
      key = decodeURIComponent(key);
    } catch {
      // ignore
    }
    key = key.replace(/^\//, '');

    if (!key) {
      return new Response('Not found', { status: 404 });
    }

    // Verify signed URL token if signing is enforced
    if (
      isSignedDeliveryEnabled() &&
      !verifySignedUrlToken(key, request.nextUrl.searchParams.get('token'))
    ) {
      return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const candidateKeys = [
      key,
      `${org.slug}/${key}`,
      key.replace(new RegExp(`^${org.slug}/`), ''),
    ];

    const baseName = key.replace(/\.[a-zA-Z0-9]+$/, '');
    const candidateIds = [key, baseName, baseName.split('/').pop() || ''];

    // ── Handle IMAGE Delivery ──────────────────────────────────────
    if (resourceType === 'image') {
      const activeNamedTransforms = await prisma.namedTransformation.findMany({
        where: { active: true },
        select: { name: true, params: true },
      });
      const namedTransforms = Object.fromEntries(
        activeNamedTransforms.map((row) => [row.name, row.params])
      );
      const queryParams = parseTransformParams(
        request.nextUrl.searchParams,
        namedTransforms
      ) as TransformParams;

      const params: TransformParams = {
        ...pathTransforms,
        ...queryParams,
        ...(pathTransforms.e || queryParams.e
          ? { e: [...(pathTransforms.e || []), ...(queryParams.e || [])] }
          : {}),
      };
      const hasTransforms = hasTransformParams(params);

      // Lookup image in database
      const image = await prisma.image.findFirst({
        where: {
          OR: [
            { storagePath: { in: candidateKeys } },
            { id: { in: candidateIds } },
            { originalName: { in: [key, key.split('/').pop() || ''] } },
          ],
        },
        select: { id: true, storagePath: true, fileSize: true, format: true, mimeType: true },
      });

      if (!image) {
        return new Response('Image not found', { status: 404 });
      }

      const storagePath = image.storagePath;

      // Fast-path: serve original when no transforms are requested
      if (!hasTransforms) {
        const origCacheKey = `orig:${storagePath}`;
        const cached = transformCache.get(origCacheKey);
        if (cached) {
          void recordImageDelivery({
            imageId: image.id,
            kind: 'original',
            bytes: cached.buffer.length,
            referer: request.headers.get('referer'),
            userAgent: request.headers.get('user-agent'),
          }).catch(() => {});
          return new Response(new Uint8Array(cached.buffer), {
            headers: { 'Content-Type': cached.contentType, ...cacheHeaders() },
          });
        }

        const diskCached = await diskCache.get(origCacheKey);
        if (diskCached) {
          transformCache.set(origCacheKey, {
            buffer: diskCached.buffer,
            contentType: diskCached.contentType,
          });
          void recordImageDelivery({
            imageId: image.id,
            kind: 'original',
            bytes: diskCached.buffer.length,
            referer: request.headers.get('referer'),
            userAgent: request.headers.get('user-agent'),
          }).catch(() => {});
          return new Response(new Uint8Array(diskCached.buffer), {
            headers: { 'Content-Type': diskCached.contentType, ...cacheHeaders() },
          });
        }

        let fetched;
        try {
          fetched = await getFromStorage(storagePath);
        } catch {
          return new Response('Not found', { status: 404 });
        }

        const entry = { buffer: fetched.buffer, contentType: fetched.contentType };
        transformCache.set(origCacheKey, entry);
        diskCache.set(origCacheKey, entry).catch(() => {});

        void recordImageDelivery({
          imageId: image.id,
          kind: 'original',
          bytes: fetched.buffer.length,
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
        }).catch(() => {});

        return new Response(new Uint8Array(fetched.buffer), {
          headers: { 'Content-Type': fetched.contentType, ...cacheHeaders() },
        });
      }

      // Serve transformed image
      let overlayBuffer: Buffer | null = null;
      if (params.overlayId) {
        const overlayImage = await prisma.image.findFirst({
          where: {
            OR: [
              { id: params.overlayId },
              { storagePath: { contains: params.overlayId } },
              { originalName: params.overlayId },
            ],
          },
          select: { storagePath: true },
        });
        if (overlayImage) {
          try {
            const fetchedOverlay = await getFromStorage(overlayImage.storagePath);
            overlayBuffer = fetchedOverlay.buffer;
          } catch {
            overlayBuffer = null;
          }
        }
      }

      const cacheKey = transformCacheKey(storagePath, params);
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

      const diskCached = await diskCache.get(cacheKey);
      if (diskCached) {
        transformCache.set(cacheKey, {
          buffer: diskCached.buffer,
          contentType: diskCached.contentType,
        });
        void recordImageDelivery({
          imageId: image.id,
          kind: 'transform',
          bytes: diskCached.buffer.length,
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
        }).catch(() => {});
        return new Response(new Uint8Array(diskCached.buffer), {
          headers: { 'Content-Type': diskCached.contentType, ...cacheHeaders() },
        });
      }

      let fetched;
      try {
        fetched = await getFromStorage(storagePath);
      } catch {
        return new Response('Not found', { status: 404 });
      }

      const acceptHeader = request.headers.get('accept');
      const transformed = await transformImage(
        fetched.buffer,
        params,
        overlayBuffer || undefined,
        acceptHeader
      );

      const entry = { buffer: transformed.buffer, contentType: transformed.contentType };
      transformCache.set(cacheKey, entry);
      diskCache.set(cacheKey, entry).catch(() => {});

      void recordImageDelivery({
        imageId: image.id,
        kind: 'transform',
        bytes: transformed.buffer.length,
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});

      const varyHeader: Record<string, string> = transformed.isAutoFormat
        ? { Vary: 'Accept' }
        : {};

      return new Response(new Uint8Array(transformed.buffer), {
        headers: {
          'Content-Type': transformed.contentType,
          ...cacheHeaders(),
          ...varyHeader,
        },
      });
    }

    // ── Handle VIDEO Delivery ──────────────────────────────────────
    if (resourceType === 'video') {
      const isPosterRequest =
        /\.(?:jpe?g|png|webp)$/i.test(key) ||
        Boolean(request.nextUrl.searchParams.get('so')) ||
        Boolean(pathTransforms.e);

      const video = await prisma.video.findFirst({
        where: {
          OR: [
            { storagePath: { in: candidateKeys } },
            { id: { in: candidateIds } },
            { originalName: { in: [key, key.split('/').pop() || ''] } },
            { posterPath: { in: candidateKeys } },
          ],
        },
        select: {
          id: true,
          storagePath: true,
          posterPath: true,
          fileSize: true,
          mimeType: true,
        },
      });

      if (!video) {
        return new Response('Video not found', { status: 404 });
      }

      // Poster thumbnail frame delivery
      if (isPosterRequest) {
        if (!video.posterPath) {
          return new Response('Poster not available', { status: 404 });
        }

        let poster;
        try {
          poster = await getFromStorage(video.posterPath);
        } catch {
          return new Response('Poster not found in storage', { status: 404 });
        }

        const queryParams = parseTransformParams(request.nextUrl.searchParams);
        const params: TransformParams = { ...pathTransforms, ...queryParams };
        const hasTransforms = hasTransformParams(params);

        if (!hasTransforms) {
          void recordVideoDelivery({
            videoId: video.id,
            label: 'poster',
            bytes: poster.buffer.length,
            referer: request.headers.get('referer'),
            userAgent: request.headers.get('user-agent'),
          }).catch(() => {});

          return new Response(new Uint8Array(poster.buffer), {
            headers: { 'Content-Type': poster.contentType, ...cacheHeaders() },
          });
        }

        const transformedPoster = await transformImage(
          poster.buffer,
          params,
          undefined,
          request.headers.get('accept')
        );

        void recordVideoDelivery({
          videoId: video.id,
          label: 'poster-transform',
          bytes: transformedPoster.buffer.length,
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
        }).catch(() => {});

        return new Response(new Uint8Array(transformedPoster.buffer), {
          headers: { 'Content-Type': transformedPoster.contentType, ...cacheHeaders() },
        });
      }

      // Video streaming with HTTP 206 Range support
      const range = request.headers.get('range');
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) return new Response('Invalid Range', { status: 416 });

        const [startText, endText] = match.slice(1);
        let start = startText ? Number.parseInt(startText, 10) : 0;
        let end = endText
          ? Number.parseInt(endText, 10)
          : Math.min(start + 1024 * 1024 - 1, video.fileSize - 1);
        start = Math.max(0, start);
        end = Math.min(end, video.fileSize - 1);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          return new Response('Range not satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${video.fileSize}` },
          });
        }

        const result = await getVideoFromStorage(video.storagePath, `bytes=${start}-${end}`);
        const streamHeaders = new Headers(cacheHeaders());
        streamHeaders.set('Content-Type', result.contentType || video.mimeType || 'video/mp4');
        streamHeaders.set('Accept-Ranges', 'bytes');
        streamHeaders.set('Content-Range', `bytes ${start}-${end}/${video.fileSize}`);
        streamHeaders.set('Content-Length', String(end - start + 1));

        void recordVideoDelivery({
          videoId: video.id,
          bytes: end - start + 1,
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
        }).catch(() => {});

        return new Response(new Uint8Array(result.buffer), { status: 206, headers: streamHeaders });
      }

      // Stream entire video from start if no range is provided
      const result = await getVideoFromStorage(video.storagePath);
      const streamHeaders = new Headers(cacheHeaders());
      streamHeaders.set('Content-Type', result.contentType || video.mimeType || 'video/mp4');
      streamHeaders.set('Accept-Ranges', 'bytes');
      if (video.fileSize > 0) {
        streamHeaders.set('Content-Length', String(video.fileSize));
      }

      void recordVideoDelivery({
        videoId: video.id,
        bytes: video.fileSize,
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});

      return new Response(new Uint8Array(result.buffer), { status: 200, headers: streamHeaders });
    }

    return new Response('Not found', { status: 404 });
  });
}
