import { prisma } from '@/lib/prisma';
import { serializeImage } from '@/lib/utils';
import { getStorageProviderInfo } from '@/lib/storage';
import { getAccountStorageUsage } from '@/lib/quota';
import { getTenantIdOrNull } from '@/lib/tenant';
import type { StatsResponse } from '@/types';

export function formatStorage(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const val = bytes / Math.pow(k, i);
  const formatted = Number.isInteger(val)
    ? val.toString()
    : val < 10 && i > 0
      ? parseFloat(val.toFixed(2)).toString()
      : parseFloat(val.toFixed(1)).toString();
  return `${formatted} ${sizes[i]}`;
}

// In-memory cache for dashboard stats to protect Cloudflare Worker Free tier (10ms-50ms CPU limit)
const statsCache = new Map<string, { data: StatsResponse; expiresAt: number }>();
const STATS_CACHE_TTL_MS = 60_000; // 60 seconds

export function invalidateStatsCache(tenantId?: string): void {
  if (tenantId) {
    statsCache.delete(tenantId);
  } else {
    statsCache.clear();
  }
}

/**
 * Helper to query dashboard statistics directly from the database using Promise.allSettled
 * for parallel execution and fault tolerance in serverless environments.
 * Caches in-memory in production to stay strictly within Cloudflare Worker free tier CPU limits.
 */
export async function getStats(): Promise<StatsResponse> {
  const tenantId = (await getTenantIdOrNull().catch(() => null)) || 'default';
  const now = Date.now();

  if (process.env.NODE_ENV !== 'test') {
    const cached = statsCache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [
    totalImagesResult,
    storageResult,
    imageVersionsStorageResult,
    imagesByFormatResult,
    imagesByFolderResult,
    recentUploadsResult,
    uploadsThisMonthResult,
    totalVideosResult,
    videoStorageResult,
    videoVersionsStorageResult,
    videoRenditionsStorageResult,
    videoHlsStorageResult,
    videoDashStorageResult,
    videoClipStorageResult,
  ] = await Promise.allSettled([
    prisma.image?.count?.() ?? Promise.resolve(0),
    prisma.image?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
    prisma.imageVersion?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
    prisma.image?.groupBy?.({ by: ['format'], _count: true }) ??
      Promise.resolve([]),
    prisma.image?.groupBy?.({ by: ['folder'], _count: true }) ??
      Promise.resolve([]),
    prisma.image?.findMany?.({ orderBy: { createdAt: 'desc' }, take: 10 }) ??
      Promise.resolve([]),
    prisma.image?.count?.({ where: { createdAt: { gte: firstOfMonth } } }) ??
      Promise.resolve(0),
    prisma.video?.count?.() ?? Promise.resolve(0),
    prisma.video?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
    prisma.videoVersion?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
    prisma.videoRendition?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
    prisma.videoHlsPackage?.aggregate?.({ _sum: { totalFileSize: true } }) ??
      Promise.resolve({ _sum: { totalFileSize: 0 } }),
    prisma.videoDashPackage?.aggregate?.({ _sum: { totalFileSize: true } }) ??
      Promise.resolve({ _sum: { totalFileSize: 0 } }),
    prisma.videoClip?.aggregate?.({ _sum: { fileSize: true } }) ??
      Promise.resolve({ _sum: { fileSize: 0 } }),
  ]);

  const totalImages = totalImagesResult.status === 'fulfilled' ? totalImagesResult.value : 0;
  const totalStorageBytes =
    (storageResult.status === 'fulfilled' && storageResult.value._sum.fileSize
      ? storageResult.value._sum.fileSize
      : 0) +
    (imageVersionsStorageResult.status === 'fulfilled' &&
    imageVersionsStorageResult.value._sum.fileSize
      ? imageVersionsStorageResult.value._sum.fileSize
      : 0);

  const imagesByFormat =
    imagesByFormatResult.status === 'fulfilled' ? imagesByFormatResult.value : [];
  const imagesByFolder =
    imagesByFolderResult.status === 'fulfilled' ? imagesByFolderResult.value : [];
  const recentUploads =
    recentUploadsResult.status === 'fulfilled' ? recentUploadsResult.value : [];
  const uploadsThisMonth =
    uploadsThisMonthResult.status === 'fulfilled' ? uploadsThisMonthResult.value : 0;
  const totalVideos =
    totalVideosResult.status === 'fulfilled' ? totalVideosResult.value : 0;

  const totalVideoBytes =
    (videoStorageResult.status === 'fulfilled' && videoStorageResult.value._sum.fileSize
      ? videoStorageResult.value._sum.fileSize
      : 0) +
    (videoVersionsStorageResult.status === 'fulfilled' &&
    videoVersionsStorageResult.value._sum.fileSize
      ? videoVersionsStorageResult.value._sum.fileSize
      : 0) +
    (videoRenditionsStorageResult.status === 'fulfilled' &&
    videoRenditionsStorageResult.value._sum.fileSize
      ? videoRenditionsStorageResult.value._sum.fileSize
      : 0) +
    (videoHlsStorageResult.status === 'fulfilled' &&
    videoHlsStorageResult.value._sum.totalFileSize
      ? videoHlsStorageResult.value._sum.totalFileSize
      : 0) +
    (videoDashStorageResult.status === 'fulfilled' &&
    videoDashStorageResult.value._sum.totalFileSize
      ? videoDashStorageResult.value._sum.totalFileSize
      : 0) +
    (videoClipStorageResult.status === 'fulfilled' &&
    videoClipStorageResult.value._sum.fileSize
      ? videoClipStorageResult.value._sum.fileSize
      : 0);

  const allStorageBytes = totalStorageBytes + totalVideoBytes;
  const providerInfo = getStorageProviderInfo();

  const quota = await getAccountStorageUsage().catch(() => null);
  const storageLimitBytes = quota?.limitBytes ?? 100 * 1024 * 1024;
  const storageLimitFormatted = quota?.limitFormatted ?? '100 MB';
  const planName = quota?.planName ?? 'Free Developer Tier';
  const storageRemainingBytes = Math.max(0, storageLimitBytes - allStorageBytes);
  const storagePercentage = Number(
    Math.min(100, Math.max(0, (allStorageBytes / storageLimitBytes) * 100)).toFixed(1)
  );
  const isQuotaExceeded = allStorageBytes >= storageLimitBytes;

  const response: StatsResponse = {
    totalImages,
    totalVideos,
    totalVideoBytes,
    totalStorageBytes: allStorageBytes,
    totalStorageFormatted: formatStorage(allStorageBytes),
    storageLimitBytes,
    storageLimitFormatted,
    storageRemainingBytes,
    storageRemainingFormatted: formatStorage(storageRemainingBytes),
    storagePercentage,
    isQuotaExceeded,
    planName,
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
    supabaseBucket: providerInfo.bucket,
  };

  statsCache.set(tenantId, {
    data: response,
    expiresAt: Date.now() + STATS_CACHE_TTL_MS,
  });

  return response;
}
