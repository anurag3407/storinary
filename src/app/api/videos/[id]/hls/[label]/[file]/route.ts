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
  const path = file;
  if (path.includes('..') || !/^[A-Za-z0-9._-]+$/.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  const deliveryPath = `/api/videos/${id}/hls/${encodeURIComponent(label)}/${path}`;
  const token = request.nextUrl.searchParams.get('token');
  if (isSignedDeliveryEnabled() && !verifySignedUrlToken(deliveryPath, token)) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const hlsPackage = await prisma.videoHlsPackage.findUnique({
    where: { videoId_label: { videoId: id, label } },
  });
  if (!hlsPackage) return new Response('Not found', { status: 404 });

  let key = '';
  let contentType = 'application/octet-stream';
  if (hlsPackage.masterPath.endsWith(`/${path}`)) {
    key = hlsPackage.masterPath;
    contentType = 'application/vnd.apple.mpegurl';
  } else {
    const variants = Array.isArray(hlsPackage.variants)
      ? hlsPackage.variants as Array<{ playlistPath?: unknown }>
      : [];
    const variant = variants.find((item) => typeof item.playlistPath === 'string' && item.playlistPath?.endsWith(`/${path}`));
    if (variant && typeof variant.playlistPath === 'string') {
      key = variant.playlistPath;
      contentType = 'application/vnd.apple.mpegurl';
    } else if (Array.isArray(hlsPackage.segmentPaths) && (hlsPackage.segmentPaths as unknown[]).includes(`videos/hls/${id}/${path}`)) {
      key = `videos/hls/${id}/${path}`;
      contentType = 'video/mp2t';
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
    return new Response('HLS asset unavailable', { status: 502 });
  }
}
