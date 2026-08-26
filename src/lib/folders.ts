import { prisma } from '@/lib/prisma';

export type FolderRecord = {
  path: string;
  imageCount: number;
  videoCount: number;
};

export type FolderOperationResult = {
  ok: boolean;
  status: number;
  error?: string;
  renamedImages?: number;
  renamedVideos?: number;
  deletedImages?: number;
  deletedVideos?: number;
};

export function normalizeFolderPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const segments = input
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..' || segment.length > 120)
  ) {
    return null;
  }
  return `/${segments.join('/')}`;
}

export async function listFolders(): Promise<FolderRecord[]> {
  const [images, videos] = await Promise.all([
    prisma.image.groupBy({ by: ['folder'], _count: true }),
    prisma.video.groupBy({ by: ['folder'], _count: true }),
  ]);

  const paths = new Set([...images.map((row) => row.folder), ...videos.map((row) => row.folder)]);
  const imageCounts = new Map(images.map((row) => [row.folder, row._count]));
  const videoCounts = new Map(videos.map((row) => [row.folder, row._count]));

  return Array.from(paths)
    .map((path) => ({
      path,
      imageCount: imageCounts.get(path) || 0,
      videoCount: videoCounts.get(path) || 0,
    }))
    .sort((first, second) => first.path.localeCompare(second.path));
}

export async function renameFolder(currentPath: string, nextPath: string): Promise<FolderOperationResult> {
  const [images, videos] = await Promise.all([
    prisma.image.updateMany({ where: { folder: currentPath }, data: { folder: nextPath } }),
    prisma.video.updateMany({ where: { folder: currentPath }, data: { folder: nextPath } }),
  ]);

  return {
    ok: true,
    status: 200,
    renamedImages: images.count,
    renamedVideos: videos.count,
  };
}

export async function deleteEmptyFolder(path: string): Promise<FolderOperationResult> {
  const [imageCount, videoCount] = await Promise.all([
    prisma.image.count({ where: { folder: path } }),
    prisma.video.count({ where: { folder: path } }),
  ]);

  if (imageCount > 0 || videoCount > 0) {
    return {
      ok: false,
      status: 409,
      error: 'Folder is not empty. Move its assets before deleting it.',
    };
  }

  return { ok: true, status: 200, deletedImages: 0, deletedVideos: 0 };
}
