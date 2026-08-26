import type { Video, VideoRendition } from '@prisma/client';

export function v1PublicId(storagePath: string) {
  return storagePath.replace(/\.[^./]+$/, '');
}

type BaseImageInput = {
  id: string;
  originalName: string;
  storagePath: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  format: string;
  mimeType: string;
  folder: string;
  tags: string;
  collections?: V1CollectionValue[];
  metadata?: StructuredMetadataValue[];
  createdAt: Date;
};

type V1VideoInput = Video & { renditions: VideoRendition[]; versions?: unknown };

type V1CollectionValue = {
  collection: {
    id: string;
    name: string;
  };
};

type StructuredMetadataValue = {
  field: { externalId: string };
  value: string;
};

type V1UploadResourceInput = {
  id?: unknown;
  publicId?: unknown;
  resourceType?: unknown;
  url?: unknown;
  publicUrl?: unknown;
  originalName?: unknown;
  width?: unknown;
  height?: unknown;
  fileSize?: unknown;
  format?: unknown;
  mimeType?: unknown;
  folder?: unknown;
  tags?: unknown;
  createdAt?: unknown;
  posterUrl?: unknown;
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function tagList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === 'string')
    : text(value).split(',').filter(Boolean);
}

export function structuredMetadataObject(values: StructuredMetadataValue[] | undefined) {
  return Object.fromEntries((values ?? []).map((entry) => [entry.field.externalId, entry.value]));
}

export function serializeV1Collections(values: V1CollectionValue[] | undefined) {
  return (values ?? []).map((item) => ({
    id: item.collection.id,
    name: item.collection.name,
  }));
}

export function serializeV1UploadResource(
  input: V1UploadResourceInput,
  fallbackResourceType: 'image' | 'video'
) {
  const storageId = text(input.id);
  const publicId = text(input.publicId, storageId);
  const url = text(input.url, text(input.publicUrl, 'url'));
  const resourceType = input.resourceType === 'video'
    || (fallbackResourceType === 'video' && input.resourceType !== 'image')
    ? 'video'
    : 'image';
  const createdAt = dateValue(input.createdAt) ?? new Date(0);

  return {
    id: storageId,
    publicId,
    resourceType,
    url,
    originalName: text(input.originalName),
    width: integer(input.width),
    height: integer(input.height),
    fileSize: integer(input.fileSize),
    format: text(input.format),
    mimeType: text(input.mimeType),
    folder: text(input.folder, '/'),
    tags: tagList(input.tags),
    ...(input.posterUrl === null || typeof input.posterUrl === 'string'
      ? { posterUrl: input.posterUrl as string | null }
      : {}),
    createdAt: createdAt.toISOString(),
    public_id: publicId,
    secure_url: url,
    resource_type: resourceType,
    created_at: createdAt.toISOString(),
    bytes: integer(input.fileSize),
  };
}

export function serializeV1Image(image: BaseImageInput) {
  return {
    id: image.id,
    publicId: v1PublicId(image.storagePath),
    resourceType: 'image' as const,
    url: image.publicUrl,
    originalName: image.originalName,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    format: image.format,
    mimeType: image.mimeType,
    folder: image.folder,
    tags: image.tags.split(',').filter(Boolean),
    collections: serializeV1Collections(image.collections),
    metadata: structuredMetadataObject(image.metadata),
    createdAt: image.createdAt.toISOString(),
    public_id: v1PublicId(image.storagePath),
    secure_url: image.publicUrl,
    resource_type: 'image',
    created_at: image.createdAt.toISOString(),
    bytes: image.fileSize,
  };
}


export function serializeV1Video(video: V1VideoInput) {
  const collections = serializeV1Collections(
    (video as unknown as { collections?: V1CollectionValue[] }).collections
  );
  const metadata = structuredMetadataObject(
    (video as unknown as { metadata?: StructuredMetadataValue[] }).metadata
  );
  return {
    id: video.id,
    publicId: v1PublicId(video.storagePath),
    resourceType: 'video' as const,
    url: video.publicUrl,
    playbackUrl: `/api/videos/${video.id}/stream`,
    posterUrl: video.posterPath ? `/api/videos/${video.id}/poster` : null,
    originalName: video.originalName,
    width: video.width,
    height: video.height,
    duration: video.duration,
    fileSize: video.fileSize,
    format: video.format,
    mimeType: video.mimeType,
    folder: video.folder,
    tags: video.tags.split(',').filter(Boolean),
    collections,
    metadata,
    status: video.status,
    renditions: video.renditions.map((rendition) => ({
      id: rendition.id,
      label: rendition.label,
      url: rendition.publicUrl,
      playbackUrl: `/api/videos/${video.id}/stream?rendition=${encodeURIComponent(rendition.label)}`,
      width: rendition.width,
      height: rendition.height,
      fileSize: rendition.fileSize,
      status: rendition.status,
    })),
    createdAt: video.createdAt.toISOString(),
    public_id: v1PublicId(video.storagePath),
    secure_url: video.publicUrl,
    resource_type: 'video',
    created_at: video.createdAt.toISOString(),
    bytes: video.fileSize,
  };
}
