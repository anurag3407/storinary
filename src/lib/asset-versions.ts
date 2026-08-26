import { prisma } from '@/lib/prisma';
import type { Image, Video } from '@prisma/client';

import type { ImageVersionRecord, VideoVersionRecord } from '@/types';

type ImageVersionRow = Omit<ImageVersionRecord, 'createdAt'> & { createdAt: Date };
type VideoVersionRow = Omit<VideoVersionRecord, 'createdAt'> & { createdAt: Date };

export function serializeImageVersion(version: ImageVersionRow): ImageVersionRecord {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

export function serializeVideoVersion(version: VideoVersionRow): VideoVersionRecord {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

export async function recordInitialImageVersion(image: Image) {
  const created = await prisma.imageVersion.create({
    data: {
      imageId: image.id,
      version: 1,
      label: 'original',
      originalName: image.originalName,
      storagePath: image.storagePath,
      publicUrl: image.publicUrl,
      width: image.width,
      height: image.height,
      fileSize: image.fileSize,
      format: image.format,
      mimeType: image.mimeType,
    },
  });
  return serializeImageVersion(created);
}

export async function recordInitialVideoVersion(video: Video) {
  const created = await prisma.videoVersion.create({
    data: {
      videoId: video.id,
      version: 1,
      label: 'original',
      originalName: video.originalName,
      storagePath: video.storagePath,
      publicUrl: video.publicUrl,
      mimeType: video.mimeType,
      posterPath: video.posterPath,
      format: video.format,
      width: video.width,
      height: video.height,
      duration: video.duration,
      fileSize: video.fileSize,
    },
  });
  return serializeVideoVersion(created);
}

async function nextImageVersion(imageId: string): Promise<number> {
  const latest = await prisma.imageVersion.findFirst({
    where: { imageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

async function nextVideoVersion(videoId: string): Promise<number> {
  const latest = await prisma.videoVersion.findFirst({
    where: { videoId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function archiveCurrentAsImageVersion(image: Image) {
  const created = await prisma.imageVersion.create({ data: {
    imageId: image.id,
    version: await nextImageVersion(image.id),
    label: 'replaced',
    originalName: image.originalName,
    storagePath: image.storagePath,
    publicUrl: image.publicUrl,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    format: image.format,
    mimeType: image.mimeType,
  } });
  return serializeImageVersion(created);
}

export async function restoreImageFromVersion(
  image: Image,
  version: ImageVersionRecord
) {
  const archived = await archiveCurrentAsImageVersion(image);
  const updated = await prisma.image.update({
    where: { id: image.id },
    data: {
      originalName: version.originalName,
      storagePath: version.storagePath,
      publicUrl: version.publicUrl,
      width: version.width,
      height: version.height,
      fileSize: version.fileSize,
      format: version.format,
      mimeType: version.mimeType,
    },
  });
  return { updated, archived };
}

export async function restoreVideoFromVersion(
  video: Video,
  version: VideoVersionRecord
) {
  const created = await prisma.videoVersion.create({ data: {
    videoId: video.id,
    version: await nextVideoVersion(video.id),
    label: 'replaced',
    originalName: video.originalName,
    storagePath: video.storagePath,
    publicUrl: video.publicUrl,
    mimeType: video.mimeType,
    posterPath: video.posterPath,
    format: video.format,
    width: video.width,
    height: video.height,
    duration: video.duration,
    fileSize: video.fileSize,
  } });
  const archived = serializeVideoVersion(created);
  const updated = await prisma.video.update({
    where: { id: video.id },
    data: {
      originalName: version.originalName,
      storagePath: version.storagePath,
      publicUrl: version.publicUrl,
      mimeType: version.mimeType,
      posterPath: version.posterPath,
      format: version.format,
      width: version.width,
      height: version.height,
      duration: version.duration,
      fileSize: version.fileSize,
    },
  });
  return { updated, archived };
}
