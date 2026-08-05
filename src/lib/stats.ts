import { prisma } from '@/lib/prisma';
import { serializeImage } from '@/lib/utils';
import type { StatsResponse } from '@/types';

function formatStorage(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Helper to query dashboard statistics directly from the database.
 */
export async function getStats(): Promise<StatsResponse> {
  const totalImages = await prisma.image.count();

  const storageResult = await prisma.image.aggregate({
    _sum: { fileSize: true },
  });
  const totalStorageBytes = storageResult._sum.fileSize || 0;

  const imagesByFormat = await prisma.image.groupBy({
    by: ['format'],
    _count: true,
  });

  const imagesByFolder = await prisma.image.groupBy({
    by: ['folder'],
    _count: true,
  });

  const recentUploads = await prisma.image.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const uploadsThisMonth = await prisma.image.count({
    where: { createdAt: { gte: firstOfMonth } },
  });

  return {
    totalImages,
    totalStorageBytes,
    totalStorageFormatted: formatStorage(totalStorageBytes),
    imagesByFormat: Object.fromEntries(
      imagesByFormat.map((g) => [g.format, g._count])
    ),
    imagesByFolder: Object.fromEntries(
      imagesByFolder.map((g) => [g.folder, g._count])
    ),
    recentUploads: recentUploads.map(serializeImage),
    uploadsThisMonth,
    supabaseBucket: process.env.SUPABASE_BUCKET_NAME || 'storinary',
  };
}
