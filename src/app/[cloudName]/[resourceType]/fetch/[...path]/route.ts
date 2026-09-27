import { NextRequest } from 'next/server';
import { prisma, rawPrisma } from '@/lib/prisma';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { fetchRemoteAsset } from '@/lib/remote-import';
import { transformImage } from '@/lib/image-processing';
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

function isAllowedFetchDomain(targetUrl: string): boolean {
  const allowed = process.env.STORINARY_ALLOWED_FETCH_DOMAINS;
  if (!allowed || allowed.trim() === '*' || allowed.trim() === '') return true;

  try {
    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    const domainList = allowed.split(',').map((d) => d.trim().toLowerCase());
    return domainList.some((domain) => {
      if (domain.startsWith('*.')) {
        const root = domain.slice(2);
        return targetHost === root || targetHost.endsWith('.' + root);
      }
      return targetHost === domain;
    });
  } catch {
    return false;
  }
}

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

    if (!isAllowedFetchDomain(remoteUrl)) {
      return new Response('Remote domain is not allowed for fetch', { status: 403 });
    }

    const queryParams = parseTransformParams(request.nextUrl.searchParams);
    const params: TransformParams = { ...pathTransforms, ...queryParams };
    const hasTransforms = hasTransformParams(params);

    const cacheKey = `fetch:${transformCacheKey(remoteUrl, params)}`;

    // L1 cache
    const cached = transformCache.get(cacheKey);
    if (cached) {
      const etag = cached.etag || computeEtag(cached.buffer);
      if (isNotModified(request, etag)) {
        return createNotModifiedResponse(etag, PUBLIC_CACHE_HEADERS);
      }
      return new Response(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': cached.contentType, ETag: etag, ...PUBLIC_CACHE_HEADERS },
      });
    }

    // L2 disk cache
    const diskCached = await diskCache.get(cacheKey);
    if (diskCached) {
      const etag = diskCached.etag || computeEtag(diskCached.buffer);
      transformCache.set(cacheKey, {
        buffer: diskCached.buffer,
        contentType: diskCached.contentType,
        etag,
      });
      if (isNotModified(request, etag)) {
        return createNotModifiedResponse(etag, PUBLIC_CACHE_HEADERS);
      }
      return new Response(new Uint8Array(diskCached.buffer), {
        headers: { 'Content-Type': diskCached.contentType, ETag: etag, ...PUBLIC_CACHE_HEADERS },
      });
    }

    // Coalesced fetch and transform execution
    let resultEntry: { buffer: Buffer; contentType: string; etag: string };
    try {
      resultEntry = await coalesceTransform(cacheKey, async () => {
        const fetched = await fetchRemoteAsset(remoteUrl, ALLOWED_FORMATS, MAX_REMOTE_SIZE);

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

        const etag = computeEtag(resultBuffer);
        const entry = { buffer: resultBuffer, contentType, etag };
        transformCache.set(cacheKey, entry);
        diskCache.set(cacheKey, entry).catch(() => {});
        return entry;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch remote asset';
      return new Response(msg, { status: 502 });
    }

    if (isNotModified(request, resultEntry.etag)) {
      return createNotModifiedResponse(resultEntry.etag, PUBLIC_CACHE_HEADERS);
    }

    return new Response(new Uint8Array(resultEntry.buffer), {
      headers: { 'Content-Type': resultEntry.contentType, ETag: resultEntry.etag, ...PUBLIC_CACHE_HEADERS },
    });
  });
}
