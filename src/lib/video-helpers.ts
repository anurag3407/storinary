import type { Video } from '@prisma/client';
import type { DashVariantRecord, HlsVariantRecord, VideoClipRecord, VideoRecord } from '@/types';
import type { VideoVersionRecord } from '@/types';

type PrismaVideo = Omit<Video, 'renditions' | 'hlsPackages' | 'dashPackages' | 'versions' | 'collections' | 'deliveryEvents' | 'aiInsights'> & {
  renditions?: unknown;
  hlsPackages?: unknown;
  dashPackages?: unknown;
  clips?: unknown;
  versions?: unknown;
};

export type VideoWithRenditions = PrismaVideo & {
  renditions?: Array<{
    id: string; label: string; publicUrl: string; storagePath: string;
    width: number; height: number; bitrateKbps: number; fileSize: number; status: string;
  }>;
  hlsPackages?: Array<{
    id: string; label: string; publicUrl: string; masterPath: string;
    variants: HlsVariantRecord[]; segmentPaths: string[]; totalFileSize: number; status: string;
  }>;
  dashPackages?: Array<{
    id: string; label: string; publicUrl: string; manifestPath: string;
    variants: DashVariantRecord[]; filePaths: string[]; totalFileSize: number; status: string;
  }>;
  clips?: Array<Omit<VideoClipRecord, 'durationSeconds'> & {
    createdAt: Date; updatedAt: Date;
  }>;
  versions?: VideoVersionRecord[];
};

type SerializedMetadata = {
  field: { externalId: string };
  value: string;
};

export function serializeVideo(video: VideoWithRenditions): VideoRecord {
  return {
    ...video,
    aiModerated: video.aiModerated ?? false,
    aiModerationScore: video.aiModerationScore ?? null,
    renditions: video.renditions ?? [],
    hlsPackages: video.hlsPackages ?? [],
    dashPackages: video.dashPackages ?? [],
    clips: (video.clips ?? []).map((clip) => ({
      ...clip,
      durationSeconds: Math.round((clip.endSeconds - clip.startSeconds) * 1000) / 1000,
      createdAt: clip.createdAt.toISOString(),
      updatedAt: clip.updatedAt.toISOString(),
    })),
    versions: video.versions ?? [],
    metadata: Object.fromEntries(
      ((video as VideoWithRenditions & { metadata?: SerializedMetadata[] }).metadata ?? [])
        .map((entry) => [entry.field.externalId, entry.value])
    ),
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}
