import { Video } from '@prisma/client';
import type { VideoRecord } from '@/types';

export function serializeVideo(video: Video): VideoRecord {
  return {
    ...video,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}
