import { NextRequest } from 'next/server';
import { prisma, rawPrisma } from '@/lib/prisma';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { fetchRemoteAsset } from '@/lib/remote-import';
import { transformImage } from '@/lib/image-processing';
import { parseCloudinaryPath } from '@/lib/cloudinary-syntax';
import { transformCache, transformCacheKey } from '@/lib/transform-cache';
import { diskCache } from '@/lib/disk-cache';
import { hasTransformParams, parseTransformParams } from '@/lib/utils';
import type { TransformParams } from '@/types';

export const runtime = 'nodejs';

const ALLOWED_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

const MAX_REMOTE_SIZE = 15 * 1024 * 1024; // 15 MB

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
};

/**
 * Cloudinary-compatible remote fetch delivery router:
 * GET /:cloudName/(image|video)/fetch/(<transformations>/)?<remote_url>
 *
 * Example:
 *   GET /demo/image/fetch/w_500,h_300,c_fill/https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cloudName: string; resourceType: string; path: string[] }> }
) {
  const { cloudName, resourceType, path } = await context.params;

  if (resourceType !== 'image') {
    return new Response('Only image fetch is supported', { status: 400 });
  }

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
    const { transformParams: pathTransforms, storagePath } = parseCloudinaryPath(rawSegments);

    // Reconstruct the remote URL from remaining path segments
    let remoteUrl = storagePath;
    if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
      if (remoteUrl.startsWith('http:/') || remoteUrl.startsWith('https:/')) {
        remoteUrl = remoteUrl.replace(/^(https?):\/+/, '$1://');
      } else {
        try {
          const decoded = decodeURIComponent(remoteUrl);
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            remoteUrl = decoded;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!remoteUrl.startsWith('https://')) {
      return new Response('A valid public HTTPS URL is required for remote fetch', {
        status: 400,
      });
    }

    const queryParams = parseTransformParams(request.nextUrl.searchParams);
    const params: TransformParams = { ...pathTransforms, ...queryParams };
    const hasTransforms = hasTransformParams(params);

    const cacheKey = `fetch:${transformCacheKey(remoteUrl, params)}`;

    // L1 cache
    const cached = transformCache.get(cacheKey);
    if (cached) {
      return new Response(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': cached.contentType, ...PUBLIC_CACHE_HEADERS },
      });
    }

    // L2 disk cache
    const diskCached = await diskCache.get(cacheKey);
    if (diskCached) {
      transformCache.set(cacheKey, {
        buffer: diskCached.buffer,
        contentType: diskCached.contentType,
      });
      return new Response(new Uint8Array(diskCached.buffer), {
        headers: { 'Content-Type': diskCached.contentType, ...PUBLIC_CACHE_HEADERS },
      });
    }

    // Fetch remote asset safely
    let fetched;
    try {
      fetched = await fetchRemoteAsset(remoteUrl, ALLOWED_FORMATS, MAX_REMOTE_SIZE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch remote asset';
      return new Response(msg, { status: 502 });
    }

    let resultBuffer = fetched.buffer;
    let contentType = fetched.contentType;

    if (hasTransforms) {
      const transformed = await transformImage(
        fetched.buffer,
        params,
        undefined,
        request.headers.get('accept')
      );
      resultBuffer = transformed.buffer;
      contentType = transformed.contentType;
    }

    const entry = { buffer: resultBuffer, contentType };
    transformCache.set(cacheKey, entry);
    diskCache.set(cacheKey, entry).catch(() => {});

    return new Response(new Uint8Array(resultBuffer), {
      headers: { 'Content-Type': contentType, ...PUBLIC_CACHE_HEADERS },
    });
  });
}
