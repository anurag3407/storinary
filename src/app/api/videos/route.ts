import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createVideoPoster } from '@/lib/image-processing';
import { generateStorageKey, getPublicUrl, uploadToStorage } from '@/lib/storage';
import {
  authorizeDashboardOrScopedUploadApiKey,
  authorizeDashboardOrReadApiKey,
} from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { getVideoMetadata } from '@/lib/video-metadata';
import { serializeVideo } from '@/lib/video-helpers';
import { generateShortId, getMimeType } from '@/lib/utils';
import {
  RENDITION_PRESETS,
  createVideoFramePoster,
  createVideoRendition,
  isFfmpegAvailable,
} from '@/lib/video-renditions';
import { dispatchWebhooks } from '@/lib/webhooks';
import { recordInitialVideoVersion } from '@/lib/asset-versions';
import type { VideoListResponse, VideoSortField } from '@/types';

export const runtime = 'nodejs';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SORT_FIELDS: VideoSortField[] = ['createdAt', 'duration', 'fileSize', 'originalName'];
const MAX_POSTER_SIZE = 5 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const auth = await authorizeDashboardOrReadApiKey(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
  const search = searchParams.get('search') || undefined;
  const folder = searchParams.get('folder') || undefined;
  const metadata = searchParams.get('metadata') || undefined;
  const collectionId = searchParams.get('collectionId') || undefined;
  const sortRaw = searchParams.get('sort') as VideoSortField | null;
  const sort = sortRaw && SORT_FIELDS.includes(sortRaw) ? sortRaw : 'createdAt';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  const where: Prisma.VideoWhereInput = {};
  if (search) {
    where.OR = [
      { originalName: { contains: search } },
      { tags: { contains: search } },
      { altText: { contains: search } },
    ];
  }
  if (folder) where.folder = folder;
  const metadataFilters = [...new URLSearchParams(metadata ?? '')]
    .filter(([field]) => field)
    .map(([field, value]) => ({
      metadata: {
        some: {
          value: { contains: value },
          field: { externalId: field, active: true },
        },
      },
    }));
  if (metadataFilters.length > 0) where.AND = metadataFilters;
  if (collectionId) {
    where.collections = { some: { collectionId } };
  }

  try {
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        renditions: true,
        metadata: { include: { field: { select: { externalId: true } } } },
      },
      }),
      prisma.video.count({ where }),
    ]);

    const response = NextResponse.json({
      videos: videos.map(serializeVideo),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    } satisfies VideoListResponse);

    if (auth.keyId) {
      await recordApiKeyUsage(auth.keyId, 'read', { assets: videos.length });
    }
    return response;
  } catch (error) {
    console.error('API /api/videos error:', error);
    return NextResponse.json({ error: 'Unable to list videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const requestedPreset = formData.get('upload_preset');
  let preset = null;
  if (typeof requestedPreset === 'string' && requestedPreset.trim()) {
    preset = await prisma.uploadPreset.findUnique({
      where: { name: requestedPreset.trim() },
    });
    if (!preset || !preset.active || preset.resourceType !== 'video') {
      return NextResponse.json(
        {
          success: false,
          videos: [],
          errors: [{
            filename: 'upload_preset',
            error: !preset || !preset.active
              ? 'Upload preset not found or inactive'
              : 'Upload preset is not configured for videos',
          }],
        },
        { status: 400 }
      );
    }
    if (!preset.unsigned) {
      formData.delete('api_key');
      if (!request.headers.get('x-api-key') && !request.headers.get('authorization')) {
        return NextResponse.json({
          error: 'Signed video preset requires API credentials',
        }, { status: 401 });
      }
    }
  }

  const auth = await authorizeDashboardOrScopedUploadApiKey(
    request,
    formData,
    'video-upload',
    preset
  );
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const files = formData.getAll('file').filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No video files provided' }, { status: 400 });
  }

  if (files.length > 5) {
    if (auth.keyId) void recordApiKeyUsage(auth.keyId, 'video-upload', { errors: files.length });
    return NextResponse.json({ error: 'Maximum 5 videos per request' }, { status: 400 });
  }

  const folder = preset?.folder ?? (formData.get('folder')?.toString() || '/');
  const tags = preset?.tags ?? (formData.get('tags')?.toString() || '');
  const altText = formData.get('altText')?.toString() || '';

  const renditionsEnabled =
    (preset?.renditions || formData.get('renditions') === 'true') &&
    await isFfmpegAvailable();

  const results = await Promise.allSettled(files.map(async (file) => {
    const mimeType = file.type || getMimeType(file.name);
    if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported video format: ${mimeType || 'unknown'}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await getVideoMetadata(buffer, mimeType);
    const shortId = generateShortId();
    const storagePath = generateStorageKey(file.name, shortId, metadata.format);
    await uploadToStorage(buffer, storagePath, mimeType);

    const posterFile = formData.get(`poster-${file.name}`);
    let posterBuffer: Buffer | null = null;
    if (posterFile instanceof File && posterFile.size > 0 && posterFile.size <= MAX_POSTER_SIZE) {
      try {
        posterBuffer = (await createVideoPoster(Buffer.from(await posterFile.arrayBuffer()))).buffer;
      } catch {
        posterBuffer = null;
      }
    }
    if (!posterBuffer && await isFfmpegAvailable()) {
      try {
        posterBuffer = await createVideoFramePoster(buffer);
      } catch {
        posterBuffer = null;
      }
    }

    const posterPath = posterBuffer
      ? generateStorageKey(`${file.name}.webp`, `${shortId}-poster`, 'webp')
      : null;
    if (posterBuffer && posterPath) await uploadToStorage(posterBuffer, posterPath, 'image/webp');

    const created = await prisma.video.create({
      data: {
        originalName: file.name,
        storagePath,
        publicUrl: getPublicUrl(storagePath),
        posterPath,
        mimeType,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        fileSize: buffer.length,
        folder,
        tags,
        altText,
      },
    });

    await recordInitialVideoVersion(created);

    if (!renditionsEnabled) return created;

    for (const label of Object.keys(RENDITION_PRESETS) as Array<keyof typeof RENDITION_PRESETS>) {
      const preset = RENDITION_PRESETS[label];
      const rendition = await createVideoRendition(buffer, label);
      const renditionKey = generateStorageKey(`${file.name}-${label}.mp4`, `${shortId}-${label}`, 'mp4');
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
        filename: files[index].name,
        error: result.reason instanceof Error ? result.reason.message : 'Upload failed',
      });
    }
  }

  if (auth.keyId) {
    await recordApiKeyUsage(auth.keyId, 'video-upload', {
      assets: videos.length,
      errors: errors.length,
      bytes: files.reduce((total, file) => total + file.size, 0),
    });
  }

  return NextResponse.json({ success: errors.length === 0, videos, errors }, { status: 201 });
}
