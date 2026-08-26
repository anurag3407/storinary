import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStorageKey, getPublicUrl, uploadToStorage } from '@/lib/storage';
import { getVideoMetadata } from '@/lib/video-metadata';
import { serializeVideo } from '@/lib/video-helpers';
import { authorizeDashboardOrApiKey } from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';
import {
  RENDITION_PRESETS,
  createVideoFramePoster,
  createVideoRendition,
  isFfmpegAvailable,
} from '@/lib/video-renditions';
import { dispatchWebhooks } from '@/lib/webhooks';
import { generateShortId } from '@/lib/utils';
import { fetchRemoteAsset, validateImportPayload } from '@/lib/remote-import';

export const runtime = 'nodejs';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_URLS = 5;
const MAX_FILE_SIZE = parseInt(process.env.MAX_VIDEO_SIZE_MB || '100', 10) * 1024 * 1024;

async function parseJson(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await parseJson(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const auth = await authorizeDashboardOrApiKey(request, undefined, 'video-upload');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const payload = validateImportPayload(body, MAX_URLS);
  if (typeof payload === 'string') {
    const response = NextResponse.json({ error: payload }, { status: 400 });
    if (auth.keyId) void recordApiKeyUsage(auth.keyId, 'video-upload', { errors: 1 });
    return response;
  }

  const renditionsEnabled = new URL(request.url).searchParams.get('renditions') === 'true'
    && await isFfmpegAvailable();

  const results = await Promise.allSettled(payload.urls.map(async (url) => {
    const remote = await fetchRemoteAsset(url, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE);
    const metadata = await getVideoMetadata(remote.buffer, remote.contentType);
    const shortId = generateShortId();
    const storagePath = generateStorageKey(
      remote.filename,
      shortId,
      metadata.format
    );
    await uploadToStorage(remote.buffer, storagePath, remote.contentType);

    let posterBuffer: Buffer | null = null;
    if (await isFfmpegAvailable()) {
      try {
        posterBuffer = await createVideoFramePoster(remote.buffer);
      } catch {
        posterBuffer = null;
      }
    }
    const posterPath = posterBuffer
      ? generateStorageKey(`${remote.filename}.webp`, `${shortId}-poster`, 'webp')
      : null;
    if (posterBuffer && posterPath) await uploadToStorage(posterBuffer, posterPath, 'image/webp');

    const created = await prisma.video.create({
      data: {
        originalName: remote.filename,
        storagePath,
        publicUrl: getPublicUrl(storagePath),
        posterPath,
        mimeType: remote.contentType,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        fileSize: remote.buffer.length,
        folder: payload.folder,
        tags: payload.tags,
        altText: '',
      },
    });

    if (!renditionsEnabled) return created;

    for (const label of Object.keys(RENDITION_PRESETS) as Array<keyof typeof RENDITION_PRESETS>) {
      const preset = RENDITION_PRESETS[label];
      const rendition = await createVideoRendition(remote.buffer, label);
      const renditionKey = generateStorageKey(`${remote.filename}-${label}.mp4`, `${shortId}-${label}`, 'mp4');
      await uploadToStorage(rendition.buffer, renditionKey, 'video/mp4');
      await prisma.videoRendition.create({
        data: {
          videoId: created.id,
          label,
          storagePath: renditionKey,
          publicUrl: getPublicUrl(renditionKey),
          width: rendition.width,
          height: rendition.height,
          bitrateKbps: preset.bitrateKbps,
          fileSize: rendition.buffer.length,
          status: 'ready',
        },
      });
    }

    return prisma.video.findUniqueOrThrow({
      where: { id: created.id },
      include: { renditions: true },
    });
  }));

  const videos = [];
  const errors = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const video = serializeVideo(result.value);
      videos.push(video);
      void dispatchWebhooks('video.uploaded', { video });
    } else {
      errors.push({
        filename: payload.urls[index],
        error: result.reason instanceof Error ? result.reason.message : 'Import failed',
      });
    }
  }

  if (auth.keyId) {
    await recordApiKeyUsage(auth.keyId, 'video-upload', {
      assets: videos.length,
      errors: errors.length,
      bytes: videos.reduce((total, video) => total + video.fileSize, 0),
    });
  }

  return NextResponse.json({ success: errors.length === 0, videos, errors }, { status: 201 });
}
