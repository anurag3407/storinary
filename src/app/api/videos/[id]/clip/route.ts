import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  deleteFromStorage,
  generateStorageKey,
  getPublicUrl,
  getVideoFromStorage,
  uploadToStorage,
} from '@/lib/storage';
import { dispatchWebhooks } from '@/lib/webhooks';
import {
  authorizeDashboardOrWriteApiKey,
  authorizeDashboardOrReadApiKey,
  authorizeDashboardOrDeleteApiKey,
  recordManagementApiKeyUsage,
} from '@/lib/media-management-auth';
import {
  MAX_VIDEO_CLIP_DURATION_SECONDS,
  createVideoClip,
  isFfmpegAvailable,
} from '@/lib/video-renditions';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function clipContentType(format: string) {
  return format === 'webm' ? 'video/webm' : 'video/mp4';
}

function parseTime(value: unknown, field: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${field} must be a number`);
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return Math.round(parsed * 1000) / 1000;
}

function safeFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 80);
  return `${base || 'video'}`;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const renditionLabel = typeof input.rendition === 'string' ? input.rendition.trim() : '';
  const persist = input.persist === true;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const format = input.format === 'webm' ? 'webm' : 'mp4';
  const muted = input.muted === true;
  const { id } = await context.params;
  if (persist && !name) {
    return NextResponse.json({ error: 'name is required when persist is true' }, { status: 400 });
  }
  if (name && (name.length > 100 || /[\\/\u0000-\u001f]/.test(name))) {
    return NextResponse.json(
      { error: 'name must be 1-100 characters without slashes or control characters' },
      { status: 400 }
    );
  }
  if (persist) {
    const existing = await prisma.videoClip.findUnique({
      where: { videoId_name: { videoId: id, name } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'A clip with this name already exists' }, { status: 409 });
    }
  }
  const video = await prisma.video.findUnique({
    where: { id },
    include: { renditions: true },
  });
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  if (video.duration <= 0) {
    return NextResponse.json({ error: 'Video duration is unavailable' }, { status: 400 });
  }

  const rendition = renditionLabel
    ? video.renditions.find((item) => item.label === renditionLabel)
    : null;
  if (renditionLabel && !rendition) {
    return NextResponse.json({ error: 'Rendition not found' }, { status: 404 });
  }

  try {
    const start = parseTime(input.start ?? input.startOffset, 'start');
    const hasDuration = input.duration !== undefined;
    const hasEnd = input.end !== undefined || input.endOffset !== undefined;
    if (hasDuration === hasEnd) {
      return NextResponse.json(
        { error: 'Provide exactly one of duration or end' },
        { status: 400 }
      );
    }

    const end = hasDuration
      ? start + parseTime(input.duration, 'duration')
      : parseTime(input.end ?? input.endOffset, 'end');
    if (end <= start) {
      return NextResponse.json({ error: 'Clip must have positive duration' }, { status: 400 });
    }
    if (end - start > MAX_VIDEO_CLIP_DURATION_SECONDS) {
      return NextResponse.json(
        { error: `Clip duration cannot exceed ${MAX_VIDEO_CLIP_DURATION_SECONDS} seconds` },
        { status: 400 }
      );
    }
    if (end > video.duration + 0.25) {
      return NextResponse.json(
        { error: `Clip end exceeds video duration (${video.duration}s)` },
        { status: 400 }
      );
    }

    if (!(await isFfmpegAvailable())) {
      return NextResponse.json({ error: 'FFmpeg is not available' }, { status: 503 });
    }

    let source;
    try {
      source = await getVideoFromStorage(rendition?.storagePath ?? video.storagePath);
    } catch {
      return NextResponse.json({ error: 'Source video unavailable' }, { status: 502 });
    }

    const buffer = await createVideoClip(source.buffer, start, end, { format, muted });
    let clip = null;
    if (persist) {
      const storagePath = generateStorageKey(
        `${safeFileName(video.originalName)}-${name}.${format}`,
        `${video.id}-clip`,
        format
      );
      await uploadToStorage(buffer, storagePath, clipContentType(format));
      clip = await prisma.videoClip.create({
        data: {
          videoId: video.id,
          name,
          storagePath,
          publicUrl: getPublicUrl(storagePath),
          mimeType: clipContentType(format),
          startSeconds: start,
          endSeconds: end,
          muted,
          sourceLabel: rendition?.label ?? null,
          fileSize: buffer.length,
        },
      });
      void dispatchWebhooks('video.clip_created', { videoId: video.id, clip });
    }
    void recordManagementApiKeyUsage(authorization.keyId, 'write', {
      assets: 1,
      bytes: buffer.length,
    }).catch(() => {});

    if (persist) return NextResponse.json({ clip }, { status: 201 });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': clipContentType(format),
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${safeFileName(video.originalName)}-clip.${format}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    void recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 }).catch(() => {});
    const message = error instanceof Error ? error.message : 'Video clipping failed';
    const status = message.startsWith('Video clipping failed') ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeDashboardOrReadApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const { id } = await context.params;
  try {
    const clips = await prisma.videoClip.findMany({
      where: { videoId: id },
      orderBy: [{ startSeconds: 'asc' }, { createdAt: 'desc' }],
    });
    void recordManagementApiKeyUsage(authorization.keyId, 'read', {}).catch(() => {});
    return NextResponse.json({
      clips: clips.map((clip) => ({
        ...clip,
        durationSeconds: Math.round((clip.endSeconds - clip.startSeconds) * 1000) / 1000,
      })),
    });
  } catch (error) {
    void recordManagementApiKeyUsage(authorization.keyId, 'read', { errors: 1 }).catch(() => {});
    console.error('API /api/videos/:id/clip GET error:', error);
    return NextResponse.json({ error: 'Unable to list clips' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext & { params: Promise<{ id: string; name?: string[] }> }
) {
  const authorization = await authorizeDashboardOrDeleteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const { id, name: nameSegments } = await context.params;
  const encodedName = nameSegments?.join('/') ?? '';
  let decodedName = '';
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch {
    return NextResponse.json({ error: 'Invalid clip name' }, { status: 400 });
  }

  try {
    const deleted = await prisma.videoClip.delete({
      where: {
        videoId_name: {
          videoId: id,
          name: decodedName,
        },
      },
    });
    await deleteFromStorage(deleted.storagePath);
    void recordManagementApiKeyUsage(authorization.keyId, 'delete', {}).catch(() => {});
    void dispatchWebhooks('video.clip_deleted', {
      videoId: id,
      clip: deleted,
    });
    return NextResponse.json({ success: true, deleted: deleted.name });
  } catch (error) {
    void recordManagementApiKeyUsage(authorization.keyId, 'delete', { errors: 1 }).catch(() => {});
    console.error('API /api/videos/:id/clip DELETE error:', error);
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }
}
