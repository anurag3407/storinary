import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoFromStorage } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return new Response('Not found', { status: 404 });

  try {
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return new Response('Invalid Range', { status: 416 });

      const [startText, endText] = match.slice(1);
      let start = startText ? Number.parseInt(startText, 10) : 0;
      let end = endText ? Number.parseInt(endText, 10) : Math.min(start + 1024 * 1024 - 1, video.fileSize - 1);
      start = Math.max(0, start);
      end = Math.min(end, video.fileSize - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return new Response('Range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${video.fileSize}` },
        });
      }

      const result = await getVideoFromStorage(video.storagePath, `bytes=${start}-${end}`);
      const totalSize = result.totalSize || video.fileSize;
      return new Response(new Uint8Array(result.buffer), {
        status: 206,
        headers: {
          'Content-Type': result.contentType,
          'Content-Length': String(result.buffer.length),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const result = await getVideoFromStorage(video.storagePath);
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType || video.mimeType,
        'Content-Length': String(result.buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Video unavailable', { status: 502 });
  }
}
