import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoFromStorage } from '@/lib/storage';
import { isSignedDeliveryEnabled, verifySignedUrlToken } from '@/lib/signed-delivery';
import { recordVideoDelivery } from '@/lib/delivery-analytics';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; label: string; file: string }> }
) {
  const { id, label, file } = await context.params;
  if (file.includes('..') || !/^[A-Za-z0-9._-]+$/.test(file)) {
    return new Response('Not found', { status: 404 });
  }

  const deliveryPath = `/api/videos/${id}/dash/${encodeURIComponent(label)}/${file}`;
  const token = request.nextUrl.searchParams.get('token');
  if (isSignedDeliveryEnabled() && !verifySignedUrlToken(deliveryPath, token)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const dashPackage = await prisma.videoDashPackage.findUnique({
    where: { videoId_label: { videoId: id, label } },
  });
  if (!dashPackage) return new Response('Not found', { status: 404 });

  let key = '';
  let contentType = 'application/octet-stream';
  if (dashPackage.manifestPath.endsWith(`/${file}`)) {
    key = dashPackage.manifestPath;
    contentType = 'application/dash+xml';
  } else {
    const variants = Array.isArray(dashPackage.variants)
      ? dashPackage.variants as Array<{ playlistPath?: unknown; initPath?: unknown; mediaSegmentPaths?: unknown }>
      : [];
    const variant = variants.find((item) =>
      item.playlistPath === `videos/dash/${id}/${file}` ||
      item.initPath === `videos/dash/${id}/${file}` ||
      Array.isArray(item.mediaSegmentPaths) && item.mediaSegmentPaths.includes(`videos/dash/${id}/${file}`)
    );
    if (variant) {
      key = `videos/dash/${id}/${file}`;
      contentType = file.endsWith('.mpd')
        ? 'application/dash+xml'
        : file.endsWith('.mp4')
          ? 'video/mp4'
          : 'video/iso.segment';
    }
  }

  if (!key) return new Response('Not found', { status: 404 });

  try {
    const result = await getVideoFromStorage(key);
    void recordVideoDelivery({
      videoId: id,
      label,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
      bytes: result.buffer.length,
    }).catch(() => {});

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(result.buffer.length),
        ...(isSignedDeliveryEnabled()
          ? { 'Cache-Control': 'private, no-store' }
          : {
              'Cache-Control': 'public, max-age=31536000, immutable',
              'CDN-Cache-Control': 'public, max-age=31536000, immutable',
            }),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('DASH asset unavailable', { status: 502 });
  }
}
