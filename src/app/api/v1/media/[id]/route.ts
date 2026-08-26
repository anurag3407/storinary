import { NextRequest, NextResponse } from 'next/server';
import { deleteFromStorage } from '@/lib/storage';
import { dispatchWebhooks } from '@/lib/webhooks';
import { prisma } from '@/lib/prisma';
import { recordApiKeyUsage } from '@/lib/api-keys';
import {
  authorizeDashboardOrWriteApiKey,
  authorizeDashboardOrDeleteApiKey,
  authorizeDashboardOrReadApiKey,
} from '@/lib/media-management-auth';
import {
  serializeV1Image,
  serializeV1Video,
} from '@/lib/v1-media';
import { validateMetadataValue } from '@/lib/structured-metadata';
import {
  restoreImageFromVersion,
  restoreVideoFromVersion,
  serializeImageVersion,
  serializeVideoVersion,
} from '@/lib/asset-versions';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

async function findImage(id: string) {
  return prisma.image.findUnique({
    where: { id },
    select: {
      id: true, originalName: true, storagePath: true, publicUrl: true,
      width: true, height: true, fileSize: true, format: true,
      mimeType: true, folder: true, tags: true, altText: true,
      bgRemoved: true, aiModerated: true, aiModerationScore: true,
      compressed: true, createdAt: true, updatedAt: true,
      versions: { orderBy: { version: 'desc' } },
      collections: { include: { collection: { select: { id: true, name: true } } } },
      metadata: { include: { field: { select: { externalId: true } } } },
    },
  });
}

async function findVideo(id: string) {
  return prisma.video.findUnique({
    where: { id },
    include: {
      renditions: true,
      versions: { orderBy: { version: 'desc' } },
      collections: { include: { collection: { select: { id: true, name: true } } } },
      metadata: { include: { field: { select: { externalId: true } } } },
    },
  });
}

async function deleteImage(id: string): Promise<'image' | null> {
  const image = await prisma.image.findUnique({
    where: { id },
    include: { versions: true },
  });
  if (!image) return null;
  try {
    await deleteFromStorage(image.storagePath);
    for (const version of image.versions) {
      await deleteFromStorage(version.storagePath);
    }
  } catch {
    // Preserve existing best-effort image deletion behavior.
  }
  await prisma.image.delete({ where: { id } });
  void dispatchWebhooks('image.deleted', { id, image });
  return 'image';
}

async function deleteVideo(id: string): Promise<'video' | null> {
  const video = await prisma.video.findUnique({
    where: { id },
    include: { renditions: true, versions: true, clips: true },
  });
  if (!video) return null;
  try {
    await deleteFromStorage(video.storagePath);
    if (video.posterPath) await deleteFromStorage(video.posterPath);
    for (const version of video.versions) {
      await deleteFromStorage(version.storagePath);
      if (version.posterPath) await deleteFromStorage(version.posterPath);
    }
    for (const rendition of video.renditions) {
      await deleteFromStorage(rendition.storagePath);
    }
    for (const clip of video.clips) {
      await deleteFromStorage(clip.storagePath);
    }
  } catch {
    return null;
  }
  await prisma.video.delete({ where: { id } });
  void dispatchWebhooks('video.deleted', { id, video });
  return 'video';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await authorizeDashboardOrReadApiKey(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  const requestedType = request.nextUrl.searchParams.get('resource_type') || 'image';
  if (requestedType !== 'image' && requestedType !== 'video') {
    return NextResponse.json({ error: 'resource_type must be image or video' }, { status: 400 });
  }

  const { id } = await context.params;
  const [image, video] = await Promise.all([
    requestedType === 'image' ? findImage(id) : Promise.resolve(null),
    requestedType === 'video' ? findVideo(id) : Promise.resolve(null),
  ]);
  const resource = image
    ? serializeV1Image(image)
    : video
      ? serializeV1Video(video)
      : null;
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (authorization.keyId) {
    await recordApiKeyUsage(authorization.keyId, 'read', { assets: 1 });
  }
  return NextResponse.json({ resources: [resource] });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authorization = await authorizeDashboardOrDeleteApiKey(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  const requestedType = request.nextUrl.searchParams.get('resource_type') || 'all';
  if (requestedType !== 'image' && requestedType !== 'video' && requestedType !== 'all') {
    return NextResponse.json({ error: 'resource_type must be image, video, or all' }, { status: 400 });
  }

  const { id } = await context.params;
  let deletedType: 'image' | 'video' | null = null;
  if (requestedType === 'image') deletedType = await deleteImage(id);
  else if (requestedType === 'video') deletedType = await deleteVideo(id);
  else {
    deletedType = (await deleteVideo(id)) ?? await deleteImage(id);
  }
  if (!deletedType) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (authorization.keyId) {
    await recordApiKeyUsage(authorization.keyId, 'delete', { assets: 1 });
  }
  return NextResponse.json({
    success: true,
    deleted: [{ id, resourceType: deletedType }],
    public_id: id,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  const requestedType = request.nextUrl.searchParams.get('resource_type') || 'image';
  if (requestedType !== 'image' && requestedType !== 'video') {
    return NextResponse.json({ error: 'resource_type must be image or video' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  if (typeof body?.restoreVersionId === 'string') {
    const { id } = await context.params;
    if (requestedType === 'image') {
      const image = await findImage(id);
      if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const version = image.versions.find((candidate) => candidate.id === body.restoreVersionId);
      if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
      const restored = await restoreImageFromVersion(image, serializeImageVersion(version));
      const restoredResource = {
        ...restored.updated,
        altText: image.altText,
        bgRemoved: image.bgRemoved,
        aiModerated: image.aiModerated,
        aiModerationScore: image.aiModerationScore,
        compressed: image.compressed,
        updatedAt: new Date(),
      };
      void dispatchWebhooks('image.updated', {
        id,
        image: serializeV1Image(restoredResource),
        action: 'restored',
      });
      return NextResponse.json({
        restoredVersion: {
          id: restored.archived.id,
          version: restored.archived.version,
        },
        resources: [serializeV1Image(restoredResource)],
      });
    }

    const video = await findVideo(id);
    if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const version = video.versions.find((candidate) => candidate.id === body.restoreVersionId);
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    const restored = await restoreVideoFromVersion(video, serializeVideoVersion(version));
    const restoredResource = { ...restored.updated, renditions: video.renditions };
    void dispatchWebhooks('video.updated', {
      id,
      video: serializeV1Video(restoredResource),
      action: 'restored',
    });
    return NextResponse.json({
      restoredVersion: {
        id: restored.archived.id,
        version: restored.archived.version,
      },
      resources: [serializeV1Video({ ...restoredResource, versions: [] })],
    });
  }
  const data: { tags?: string; altText?: string; folder?: string } = {};
  if (typeof body?.tags === 'string') data.tags = body.tags;
  if (typeof body?.altText === 'string') data.altText = body.altText;
  if (typeof body?.folder === 'string') data.folder = body.folder || '/';

  const metadataInput = body?.metadata;
  if (metadataInput !== undefined && (typeof metadataInput !== 'object' || Array.isArray(metadataInput) || metadataInput === null)) {
    return NextResponse.json({ error: 'metadata must be an object of field IDs' }, { status: 400 });
  }

  if (Object.keys(data).length === 0 && Object.keys(metadataInput ?? {}).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { id } = await context.params;
  let fieldRecords: Array<{
    id: string;
    externalId: string;
    type: string;
    required: boolean;
    allowedValues: string;
  }> = [];
  const metadataOperations: Array<{
    externalId: string;
    value: string;
    fieldId: string;
    create: Record<string, unknown>;
  }> = [];

  if (metadataInput) {
    const externalIds = Object.keys(metadataInput);
    fieldRecords = await prisma.metadataField.findMany({
      where: { externalId: { in: externalIds }, active: true },
    });
    const fieldsById = new Map(fieldRecords.map((field) => [field.externalId, field]));
    for (const externalId of externalIds) {
      const field = fieldsById.get(externalId);
      if (!field) return NextResponse.json({ error: `Unknown or inactive metadata field: ${externalId}` }, { status: 400 });
      try {
        const value = validateMetadataValue(field, metadataInput[externalId]);
        metadataOperations.push({
          externalId,
          value,
          fieldId: field.id,
          create: {
            fieldId: field.id,
            value,
            ...(requestedType === 'video' ? { videoId: id } : { imageId: id }),
          },
        });
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : `Invalid metadata for ${externalId}`,
        }, { status: 400 });
      }
    }
  }

  try {
    if (requestedType === 'video') {
      const video = await prisma.video.update({
        where: { id },
        data,
        include: {
          renditions: true,
          metadata: { include: { field: { select: { externalId: true } } } },
        },
      });
      for (const operation of metadataOperations) {
        if (operation.value === '') {
          await prisma.structuredMetadata.deleteMany({
            where: { fieldId: operation.fieldId, videoId: id },
          });
        } else {
          await prisma.structuredMetadata.upsert({
            where: {
              fieldId_videoId: { fieldId: operation.fieldId, videoId: id },
            },
            create: operation.create as never,
            update: { value: operation.value },
          });
        }
      }
      void dispatchWebhooks('video.updated', { id, video: serializeV1Video(video) });
      return NextResponse.json({ resources: [serializeV1Video(video)] });
    }

    const image = await prisma.image.update({
      where: { id },
      data,
      include: { metadata: { include: { field: { select: { externalId: true } } } } },
    });
    for (const operation of metadataOperations) {
      if (operation.value === '') {
        await prisma.structuredMetadata.deleteMany({
          where: { fieldId: operation.fieldId, imageId: id },
        });
      } else {
        await prisma.structuredMetadata.upsert({
          where: {
            fieldId_imageId: { fieldId: operation.fieldId, imageId: id },
          },
          create: operation.create as never,
          update: { value: operation.value },
        });
      }
    }
    void dispatchWebhooks('image.updated', { image });
    return NextResponse.json({ resources: [serializeV1Image(image)] });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } finally {
    if (authorization.keyId) {
      await recordApiKeyUsage(authorization.keyId, 'write', { assets: 1 });
    }
  }
}
