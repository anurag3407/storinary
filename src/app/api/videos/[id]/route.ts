import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteFromStorage } from '@/lib/storage';
import { canManageMedia } from '@/lib/media-auth';
import { deleteHlsPackageFiles, normalizeHlsPackage } from '@/lib/video-hls';
import { deleteDashPackageFiles, normalizeDashPackage } from '@/lib/video-dash';
import {
  buildSignedPosterUrl,
  buildSignedVideoStreamUrl,
  normalizeSignedUrlTtl,
} from '@/lib/signed-delivery';
import { dispatchWebhooks } from '@/lib/webhooks';
import { serializeVideo } from '@/lib/video-helpers';
import { validateMetadataValue } from '@/lib/structured-metadata';
import {
  restoreVideoFromVersion,
  serializeVideoVersion,
} from '@/lib/asset-versions';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      renditions: true,
      clips: true,
      hlsPackages: true,
      dashPackages: true,
      versions: { orderBy: { version: 'desc' } },
      metadata: { include: { field: { select: { externalId: true } } } },
    },
  });
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

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
    for (const hlsPackage of video.hlsPackages) {
      await deleteHlsPackageFiles(hlsPackage, deleteFromStorage);
    }
    for (const dashPackage of video.dashPackages) {
      await deleteDashPackageFiles(normalizeDashPackage(dashPackage), deleteFromStorage);
    }
    for (const clip of video.clips) {
      await deleteFromStorage(clip.storagePath);
    }
  } catch (error) {
    console.error('API /api/videos delete storage error:', error);
    return NextResponse.json({ error: 'Unable to delete video files' }, { status: 500 });
  }

  await prisma.video.delete({ where: { id } });
  void dispatchWebhooks('video.deleted', { id: video.id, video });
  return NextResponse.json({ success: true, deleted: video.id });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.restoreVersionId === 'string') {
    const current = await prisma.video.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (!current) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    const version = current.versions.find((candidate) => candidate.id === body.restoreVersionId);
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    const restored = await restoreVideoFromVersion(current, serializeVideoVersion(version));
    void dispatchWebhooks('video.updated', {
      id,
      video: restored.updated,
      action: 'restored',
    });
    return NextResponse.json(serializeVideo(restored.updated));
  }

  const metadataInput = body.metadata;
  if (metadataInput !== undefined && (typeof metadataInput !== 'object' || Array.isArray(metadataInput) || metadataInput === null)) {
    return NextResponse.json({ error: 'metadata must be an object of field IDs' }, { status: 400 });
  }

  const data: { tags?: string; altText?: string; folder?: string } = {};
  if (typeof body.tags === 'string') data.tags = body.tags;
  if (typeof body.altText === 'string') data.altText = body.altText;
  if (typeof body.folder === 'string') data.folder = body.folder || '/';

  if (Object.keys(data).length === 0 && Object.keys(metadataInput ?? {}).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const externalIds = Object.keys(metadataInput ?? {});
  const metadataOperations: Array<{
    fieldId: string;
    value: string;
    create: Record<string, unknown>;
  }> = [];

  for (const externalId of externalIds) {
    const field = await prisma.metadataField.findFirst({
      where: { externalId, active: true },
    });
    if (!field) {
      return NextResponse.json({ error: `Unknown or inactive metadata field: ${externalId}` }, { status: 400 });
    }
    try {
      const value = validateMetadataValue(field, (metadataInput as Record<string, unknown>)[externalId]);
      metadataOperations.push({
        fieldId: field.id,
        value,
        create: { fieldId: field.id, value, videoId: id },
      });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : `Invalid metadata for ${externalId}`,
      }, { status: 400 });
    }
  }

  try {
      const video = await prisma.video.update({
        where: { id },
        data,
        include: {
          renditions: true,
          hlsPackages: true,
          dashPackages: true,
          versions: true,
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
            where: { fieldId_videoId: { fieldId: operation.fieldId, videoId: id } },
            create: operation.create as never,
            update: { value: operation.value },
          });
        }
      }
      const serialized = serializeVideo({
        ...video,
        hlsPackages: video.hlsPackages.map(normalizeHlsPackage),
        dashPackages: video.dashPackages.map(normalizeDashPackage),
        versions: video.versions.map(serializeVideoVersion),
      });
      const ttl = normalizeSignedUrlTtl(request.nextUrl.searchParams.get('ttl'));
      const links = {
        streamUrl: buildSignedVideoStreamUrl(request, id, ttl),
        posterUrl: video.posterPath ? buildSignedPosterUrl(request, id, ttl) : null,
        renditionUrls: Object.fromEntries(video.renditions.map((rendition) => [
          rendition.label,
          buildSignedVideoStreamUrl(request, id, ttl, rendition.label),
        ])),
      };
      void dispatchWebhooks('video.updated', { id, video: serialized });
      return NextResponse.json({ ...serialized, links });
  } catch (error) {
    console.error('API /api/videos/:id PATCH error:', error);
    return NextResponse.json({ error: 'Unable to update video' }, { status: 500 });
  }
}
