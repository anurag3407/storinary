import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeDashboardOrApiKey,
  authorizeDashboardOrReadApiKey,
} from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { prisma } from '@/lib/prisma';
import { bulkDeleteFromStorage } from '@/lib/storage';
import { dispatchWebhooks } from '@/lib/webhooks';
import { authorizeDashboardOrDeleteApiKey } from '@/lib/media-management-auth';
import {
  serializeV1Image,
  serializeV1Video,
  serializeV1UploadResource,
} from '@/lib/v1-media';

export const runtime = 'nodejs';

const RESOURCE_TYPES = new Set(['image', 'video', 'all']);

export async function GET(request: NextRequest) {
  const authorization = await authorizeDashboardOrReadApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
  const cursor = typeof searchParams.get('cursor') === 'string' ? searchParams.get('cursor')! : undefined;
  const folder = searchParams.get('folder') || undefined;
  const collectionId = searchParams.get('collection_id') || undefined;
  const requestedType = searchParams.get('resource_type') || 'image';
  if (!RESOURCE_TYPES.has(requestedType)) {
    return NextResponse.json({ error: 'resource_type must be image, video, or all' }, { status: 400 });
  }

  const resources: Array<
    ReturnType<typeof serializeV1Image> | ReturnType<typeof serializeV1Video>
  > = [];
  let nextCursor: string | null = null;
  const metadataFilters = [...new URLSearchParams(searchParams.get('metadata') ?? '')]
    .filter(([field]) => field)
    .map(([field, value]) => ({
      metadata: {
        some: {
          value: { contains: value },
          field: { externalId: field, active: true },
        },
      },
    }));
  const baseWhere = folder ? { folder } : {};
  const where = {
    ...baseWhere,
    ...(collectionId ? { collections: { some: { collectionId } } } : {}),
    ...(metadataFilters.length > 0 ? { AND: metadataFilters } : {}),
  };
  if (requestedType === 'video') {
    const videos = await prisma.video.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        renditions: true,
        collections: { include: { collection: { select: { id: true, name: true } } } },
        metadata: { include: { field: { select: { externalId: true } } } },
      },
    });
    const hasMore = videos.length > limit;
    const page = hasMore ? videos.slice(0, limit) : videos;
    nextCursor = hasMore ? page[page.length - 1].id : null;
    resources.push(...page.map(serializeV1Video));
  } else if (requestedType === 'all') {
    const [images, videos] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          originalName: true,
          storagePath: true,
          publicUrl: true,
          width: true,
          height: true,
          fileSize: true,
          format: true,
          mimeType: true,
          folder: true,
          tags: true,
          collections: { include: { collection: { select: { id: true, name: true } } } },
          metadata: { include: { field: { select: { externalId: true } } } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          renditions: true,
          collections: { include: { collection: { select: { id: true, name: true } } } },
          metadata: { include: { field: { select: { externalId: true } } } },
        },
      }),
    ]);
    resources.push(...[
      ...images.map(serializeV1Image),
      ...videos.map(serializeV1Video),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit));
  } else {
    const images = await prisma.image.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        originalName: true,
        storagePath: true,
        publicUrl: true,
        width: true,
        height: true,
        fileSize: true,
        format: true,
        mimeType: true,
          folder: true,
          tags: true,
          collections: { include: { collection: { select: { id: true, name: true } } } },
          metadata: { include: { field: { select: { externalId: true } } } },
        createdAt: true,
        updatedAt: true,
      },
    });
    const hasMore = images.length > limit;
    const page = hasMore ? images.slice(0, limit) : images;
    nextCursor = hasMore ? page[page.length - 1].id : null;
    resources.push(...page.map(serializeV1Image));
  }

  if (authorization.keyId) {
    await recordApiKeyUsage(authorization.keyId, 'read', { assets: resources.length });
  }

  return NextResponse.json({
    resources,
    pagination: {
      nextCursor,
    },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const authorization = await authorizeDashboardOrApiKey(request, formData, 'upload');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const files = formData.getAll('file').filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

  const rawResourceType = formData.get('resource_type')?.toString() || 'image';
  if (rawResourceType === 'auto' || rawResourceType === 'raw') {
    return NextResponse.json({ error: 'resource_type must be image or video; auto/raw is not supported' }, { status: 400 });
  }
  if (!RESOURCE_TYPES.has(rawResourceType)) {
    return NextResponse.json({ error: 'resource_type must be image or video' }, { status: 400 });
  }

  const resourceType = rawResourceType as 'image' | 'video';
  const uploadPath = `/api/${resourceType}s`;
  const responseKey = resourceType === 'video' ? 'videos' : 'images';
  const results = await Promise.allSettled(files.map(async (file) => {
    const response = await fetch(new URL(uploadPath, request.nextUrl.origin), {
      method: 'POST',
      headers: Object.fromEntries(request.headers.entries()),
      body: (() => {
        const forward = new FormData();
        for (const [key, value] of formData.entries()) {
        if (key === 'file' || key === 'resource_type' || key === 'api_key' || key === 'api_signature' || key === 'timestamp') continue;
          if (typeof value === 'string') forward.set(key, value);
        }
        forward.set('file', file);
        if (formData.has('upload_preset')) forward.set('upload_preset', String(formData.get('upload_preset')));
        if (formData.has('folder')) forward.set('folder', String(formData.get('folder')));
        if (formData.has('tags')) forward.set('tags', String(formData.get('tags')));
        return forward;
      })(),
    });
    let payload: {
      success?: boolean;
      images?: unknown[];
      videos?: unknown[];
      errors?: Array<{ error?: string }>;
    };
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Upload failed (${response.status})`);
    }
    const createdResources = payload[responseKey];
    if (!response.ok || !payload.success || !Array.isArray(createdResources) || createdResources.length !== 1) {
      throw new Error(payload?.errors?.[0]?.error || `Upload failed (${response.status})`);
    }
    if (!createdResources[0] || typeof createdResources[0] !== 'object') {
      throw new Error(`Upload failed (${response.status})`);
    }
    return serializeV1UploadResource(
      createdResources[0] as Record<string, unknown>,
      resourceType
    );
  }));

  const resources: unknown[] = [];
  const errors: Array<{ filename: string; error: string }> = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') resources.push(result.value);
    else errors.push({ filename: files[index].name, error: result.reason instanceof Error ? result.reason.message : 'Upload failed' });
  }

  if (authorization.keyId && errors.length > 0) {
    void recordApiKeyUsage(authorization.keyId, 'upload', { errors: errors.length });
  }

  return NextResponse.json({
    success: errors.length === 0,
    resources,
    errors,
  }, { status: errors.length === 0 ? 201 : 207 });
}

export async function DELETE(request: NextRequest) {
  const authorization = await authorizeDashboardOrDeleteApiKey(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  let ids: string[] = [];
  try {
    const body = await request.json();
    ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: 'No media IDs provided' }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Cannot delete more than 100 media items at once' }, { status: 400 });
  }

  const [images, videos] = await Promise.all([
    prisma.image.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, storagePath: true },
    }),
    prisma.video.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        storagePath: true,
        posterPath: true,
        renditions: { select: { storagePath: true } },
      },
    }),
  ]);
  const imageById = new Map(images.map((image) => [image.id, image]));
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const pathsByMediaId = new Map<string, string[]>();
  for (const image of images) pathsByMediaId.set(image.id, [image.storagePath]);
  for (const video of videos) {
    pathsByMediaId.set(video.id, [
      video.storagePath,
      ...(video.posterPath ? [video.posterPath] : []),
      ...video.renditions.map((rendition) => rendition.storagePath),
    ]);
  }

  const results = await Promise.all([...pathsByMediaId].map(async ([id, paths]) => {
    try {
      if (paths.length > 0) await bulkDeleteFromStorage(paths);
      return { id, success: true };
    } catch {
      return { id, success: false };
    }
  }));

  const failedStorageIds = results.filter((result) => !result.success).map((result) => result.id);
  const deletableIds = uniqueIds.filter((id) => pathsByMediaId.has(id) && !failedStorageIds.includes(id));
  const imageResult = { count: 0 };
  const videoResult = { count: 0 };
  if (deletableIds.length > 0) {
    const imageIds = deletableIds.filter((id) => imageById.has(id));
    const videoIds = deletableIds.filter((id) => videoById.has(id));
    if (imageIds.length > 0) {
      imageResult.count += (await prisma.image.deleteMany({ where: { id: { in: imageIds } } })).count;
    }
    if (videoIds.length > 0) {
      videoResult.count += (await prisma.video.deleteMany({ where: { id: { in: videoIds } } })).count;
    }
  }

  const deletedImageIds = images
    .filter((image) => deletableIds.includes(image.id))
    .map((image) => ({ id: image.id, resourceType: 'image' as const }));
  const deletedVideoIds = videos
    .filter((video) => deletableIds.includes(video.id))
    .map((video) => ({ id: video.id, resourceType: 'video' as const }));
  if (deletedImageIds.length > 0) {
    void dispatchWebhooks('image.deleted', { ids: deletedImageIds.map((item) => item.id), count: deletedImageIds.length });
  }
  if (deletedVideoIds.length > 0) {
    void dispatchWebhooks('video.deleted', { ids: deletedVideoIds.map((item) => item.id), count: deletedVideoIds.length });
  }

  if (authorization.keyId) {
    await recordApiKeyUsage(authorization.keyId, 'delete', {
      assets: imageResult.count + videoResult.count,
      errors: failedStorageIds.length,
    });
  }

  const foundIds = [...pathsByMediaId.keys()];
  const notFound = ids
    .filter((id) => !foundIds.includes(id))
    .map((id) => ({ id, error: 'Not found' }));
  const storageErrors = failedStorageIds
    .filter((id) => ids.includes(id))
    .map((id) => ({ id, error: 'Storage delete failed; database record retained' }));

  return NextResponse.json({
    success: notFound.length === 0 && storageErrors.length === 0,
    deleted: imageResult.count + videoResult.count,
    resources: [...deletedImageIds, ...deletedVideoIds],
    errors: [...notFound, ...storageErrors],
  }, { status: notFound.length + storageErrors.length === 0 ? 200 : 207 });
}
