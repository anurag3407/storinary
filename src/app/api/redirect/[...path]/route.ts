import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 * params: w_*, h_*, q_*, f_webp|jpeg|png|avif (f_auto → original), c_* fit
 * mapping (c_fill→cover, c_pad→contain, c_scale/c_limit→inside). Everything
 * else (overlays, effects, video) is ignored — best effort.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const segments = (path as string[]).filter(Boolean);

  if (segments.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  // Strip the optional "image/upload" (or "image/fetch") prefix
  let rest = segments;
  if (
    rest.length >= 2 &&
    rest[0] === 'image' &&
    (rest[1] === 'upload' || rest[1] === 'fetch' || rest[1] === 'private')
  ) {
    rest = rest.slice(2);
  }

  // Only these are real Cloudinary transform prefixes. Whitelisting (instead
  // of matching any word_word segment) keeps ordinary public_ids like
  // "hero_image" or folders named "my_folder" from being eaten as transforms.
  const TRANSFORM_KEYS = new Set([
    'w', 'h', 'q', 'f', 'c', 'e', 'g', 'x', 'y', 'r', 'b', 'd', 'l', 't',
    'a', 'o', 'ar', 'dpr', 'fl', 'cs', 'co', 'k', 'p', 'u',
  ]);

  // Split Cloudinary URL segments into transforms, version, and file path.
  // In canonical Cloudinary URLs the transforms and version always come
  // before the file path, so only the leading run is parsed as such.
  const transforms: Record<string, string> = {};
  let fileSegments: string[] = [];
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
      const m = seg.match(/^([a-z]{1,4})_([a-z0-9]+)$/);
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
            if (['webp', 'jpeg', 'jpg', 'png', 'avif'].includes(value)) {
              transforms.fmt = value === 'jpg' ? 'jpeg' : value;
            }
            break;
          case 'c':
            if (value === 'fill') transforms.fit = 'cover';
            else if (value === 'pad' || value === 'contain') transforms.fit = 'contain';
            else if (value === 'scale' || value === 'limit' || value === 'fit') {
              transforms.fit = 'inside';
            } else if (value === 'crop') transforms.fit = 'cover';
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

  if (fileSegments.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  // Rebuild the public_id (+ optional extension): "products/hero.jpg"
  const filePath = fileSegments.join('/');
  const dot = filePath.lastIndexOf('.');
  const hasExt = dot > filePath.lastIndexOf('/');
  const publicId = hasExt ? filePath.slice(0, dot) : filePath;
  const ext = hasExt ? filePath.slice(dot + 1).toLowerCase() : null;

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

  // No transforms → straight to the Supabase CDN URL (permanent, like /api/serve)
  if (!transforms.w && !transforms.h && !transforms.q && !transforms.fmt && !transforms.fit) {
    return NextResponse.redirect(image.publicUrl, 301);
  }

  // Transforms → on-the-fly via /api/serve (302 while the migration settles)
  const serveUrl = new URL(
    `/api/serve/${image.storagePath}`,
    request.nextUrl.origin
  );
  for (const [k, v] of Object.entries(transforms)) {
    serveUrl.searchParams.set(k, v);
  }
  return NextResponse.redirect(serveUrl.toString(), 302);
}
