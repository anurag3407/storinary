import { prisma } from '@/lib/prisma';
import { serializeImage } from '@/lib/utils';
import { getStorageProviderInfo } from '@/lib/storage';
import type { StatsResponse } from '@/types';

function formatStorage(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Helper to query dashboard statistics directly from the database using Promise.allSettled
 * for parallel execution and fault tolerance in serverless environments.
 */
export async function getStats(): Promise<StatsResponse> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [
    totalImagesResult,
    storageResult,
    imagesByFormatResult,
    imagesByFolderResult,
    recentUploadsResult,
    uploadsThisMonthResult,
  ] = await Promise.allSettled([
    prisma.image.count(),
    prisma.image.aggregate({ _sum: { fileSize: true } }),
    prisma.image.groupBy({ by: ['format'], _count: true }),
    prisma.image.groupBy({ by: ['folder'], _count: true }),
    prisma.image.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.image.count({ where: { createdAt: { gte: firstOfMonth } } }),
  ]);

  const results = [
    totalImagesResult,
    storageResult,
    imagesByFormatResult,
    imagesByFolderResult,
    recentUploadsResult,
    uploadsThisMonthResult,
  ];
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('getStats DB query failed:', r.reason);
    }
  }

  const totalImages = totalImagesResult.status === 'fulfilled' ? totalImagesResult.value : 0;
  const totalStorageBytes =
    storageResult.status === 'fulfilled' && storageResult.value._sum.fileSize
      ? storageResult.value._sum.fileSize
      : 0;
  const imagesByFormat =
    imagesByFormatResult.status === 'fulfilled' ? imagesByFormatResult.value : [];
  const imagesByFolder =
    imagesByFolderResult.status === 'fulfilled' ? imagesByFolderResult.value : [];
  const recentUploads =
    recentUploadsResult.status === 'fulfilled' ? recentUploadsResult.value : [];
  const uploadsThisMonth =
    uploadsThisMonthResult.status === 'fulfilled' ? uploadsThisMonthResult.value : 0;

  const providerInfo = getStorageProviderInfo();

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
    provider: providerInfo.provider,
    providerName: providerInfo.providerName,
    storageBucket: providerInfo.bucket,
    storageEndpoint: providerInfo.endpoint,
    isConfigured: providerInfo.isConfigured,
    supabaseBucket: providerInfo.bucket, // backwards compatibility
  };
}
