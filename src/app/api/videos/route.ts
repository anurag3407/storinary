import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateVideoApiKey } from '@/lib/api-keys';
import { generateStorageKey, getPublicUrl, uploadToStorage } from '@/lib/storage';
import { getVideoMetadata } from '@/lib/video-metadata';
import { serializeVideo } from '@/lib/video-helpers';
import { generateShortId, getMimeType } from '@/lib/utils';
import type { VideoListResponse, VideoSortField } from '@/types';

export const runtime = 'nodejs';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SORT_FIELDS: VideoSortField[] = ['createdAt', 'duration', 'fileSize', 'originalName'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
  const search = searchParams.get('search') || undefined;
  const folder = searchParams.get('folder') || undefined;
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

  try {
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.video.count({ where }),
    ]);

    return NextResponse.json({
      videos: videos.map(serializeVideo),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    } satisfies VideoListResponse);
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

  const auth = await authenticateVideoApiKey(request, formData);
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
    return NextResponse.json({ error: 'Maximum 5 videos per request' }, { status: 400 });
  }

  const folder = formData.get('folder')?.toString() || '/';
  const tags = formData.get('tags')?.toString() || '';
  const altText = formData.get('altText')?.toString() || '';

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

    return prisma.video.create({
      data: {
        originalName: file.name,
        storagePath,
        publicUrl: getPublicUrl(storagePath),
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
  }));

  const videos = [];
  const errors = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') videos.push(serializeVideo(result.value));
    else errors.push({
      filename: files[index].name,
      error: result.reason instanceof Error ? result.reason.message : 'Upload failed',
    });
  }

  return NextResponse.json({ success: errors.length === 0, videos, errors }, { status: 201 });
}
