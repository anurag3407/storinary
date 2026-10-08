import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const MAX_DAYS = 90;

function truncateReferer(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.slice(0, 300);
  } catch {
    return value.slice(0, 300);
  }
}

function truncateUserAgent(value: string | null): string | null {
  return value ? value.replace(/\s+/g, ' ').trim().slice(0, 400) : null;
}

export async function recordImageDelivery(input: {
  imageId: string;
  kind: 'original' | 'transform';
  cacheStatus?: 'hit:memory' | 'hit:disk' | 'miss' | 'hit';
  bytes?: number;
  referer: string | null;
  userAgent: string | null;
}): Promise<void> {
  await prisma.deliveryEvent.create({
    data: {
      imageId: input.imageId || null,
      videoId: null,
      rendition: input.cacheStatus || 'hit',
      kind: input.kind === 'transform' ? `image:${input.kind}` : 'image:original',
      bytes: Math.max(0, Math.floor(input.bytes ?? 0)),
      referer: truncateReferer(input.referer),
      userAgent: truncateUserAgent(input.userAgent),
    },
  });
}

export async function recordVideoDelivery(input: {
  videoId: string;
  label?: string | null;
  bytes?: number;
  referer: string | null;
  userAgent: string | null;
}): Promise<void> {
  await prisma.deliveryEvent.create({
    data: {
      imageId: null,
      videoId: input.videoId,
      rendition: input.label || null,
      kind: input.label ? `video:rendition` : 'video:original',
      bytes: Math.max(0, Math.floor(input.bytes ?? 0)),
      referer: truncateReferer(input.referer),
      userAgent: truncateUserAgent(input.userAgent),
    },
  });
}

export type CacheAnalytics = {
  hitRatio: number;
  cachedEvents: number;
  missEvents: number;
  memoryHits: number;
  diskHits: number;
  savedBytes: number;
};

export type DeliveryAnalytics = {
  range: { days: number; from: string };
  totals: { events: number; bytes: number };
  images: { events: number; bytes: number };
  videos: { events: number; bytes: number; ranges: number };
  cache: CacheAnalytics;
  byDay: Array<{ day: string; events: number; bytes: number }>;
  topImages: Array<{ id: string; originalName: string; events: number; bytes: number; cached?: boolean }>;
  topVideos: Array<{ id: string; originalName: string; events: number; bytes: number }>;
  referrers: Array<{ origin: string; events: number }>;
};

// In-memory cache to protect Cloudflare Worker CPU limits from aggregating 140k+ delivery events
const deliveryAnalyticsCache = new Map<string, { data: DeliveryAnalytics; expiresAt: number }>();
const DELIVERY_CACHE_TTL_MS = 120_000; // 2 minutes

export function invalidateDeliveryAnalyticsCache(): void {
  deliveryAnalyticsCache.clear();
}

export async function getDeliveryAnalytics(daysInput = 30): Promise<DeliveryAnalytics> {
  const days = Math.min(MAX_DAYS, Math.max(1, Number.isFinite(daysInput) ? daysInput : 30));
  const cacheKey = `${days}`;
  const now = Date.now();
  const cached = deliveryAnalyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Pre-bind tenant scope so nested queries don't re-resolve auth
  try {
    const { getTenantIdOrNull } = await import('@/lib/tenant');
    const { enterTenantScope } = await import('@/lib/prisma-scope');
    const tenantId = (await getTenantIdOrNull().catch(() => null)) || 'default';
    enterTenantScope(tenantId);
  } catch {}

  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const isPostgres = Boolean(
    process.env.DATABASE_URL &&
      (process.env.DATABASE_URL.startsWith('postgres://') ||
        process.env.DATABASE_URL.startsWith('postgresql://'))
  );

  const [
    totalAggregate,
    imageAggregate,
    videoAggregate,
    rawGroupedDays,
    groupedImages,
    groupedVideos,
    groupedReferrers,
    groupedCache,
  ] = await Promise.all([
    prisma.deliveryEvent.aggregate({ _count: true, _sum: { bytes: true }, where: { createdAt: { gte: from } } }),
    prisma.deliveryEvent.aggregate({
      _count: true,
      _sum: { bytes: true },
      where: { createdAt: { gte: from }, imageId: { not: null } },
    }),
    prisma.deliveryEvent.aggregate({
      _count: true,
      _sum: { bytes: true },
      where: { createdAt: { gte: from }, videoId: { not: null } },
    }),
    isPostgres
      ? prisma.$queryRaw<Array<{ day: string; events: number | bigint; bytes: number | bigint }>>(Prisma.sql`
          SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS events, COALESCE(SUM("bytes"), 0)::bigint AS bytes
          FROM "DeliveryEvent" WHERE "createdAt" >= ${from} GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
        `).catch(() => [] as Array<{ day: string; events: number; bytes: number }>)
      : prisma.$queryRaw<Array<{ day: string; events: number | bigint; bytes: number | bigint }>>(Prisma.sql`
          SELECT strftime('%Y-%m-%d', "createdAt") AS day, COUNT(*) AS events, COALESCE(SUM("bytes"), 0) AS bytes
          FROM "DeliveryEvent" WHERE "createdAt" >= ${from} GROUP BY day
        `).catch(() => [] as Array<{ day: string; events: number; bytes: number }>),
    prisma.deliveryEvent.groupBy({
      by: ['imageId'],
      _count: true,
      _sum: { bytes: true },
      where: { createdAt: { gte: from }, imageId: { not: null } },
      orderBy: { _count: { imageId: 'desc' } },
      take: 10,
    }),
    prisma.deliveryEvent.groupBy({
      by: ['videoId'],
      _count: true,
      _sum: { bytes: true },
      where: { createdAt: { gte: from }, videoId: { not: null } },
      orderBy: { _count: { videoId: 'desc' } },
      take: 10,
    }),
    prisma.deliveryEvent.groupBy({
      by: ['referer'],
      _count: true,
      where: { createdAt: { gte: from }, referer: { not: null } },
      orderBy: { _count: { referer: 'desc' } },
      take: 10,
    }),
    // Images store their cache status in `rendition` ('hit:memory' | 'hit:disk'
    // | 'miss'), so we can report a real hit ratio instead of a fixed estimate.
    prisma.deliveryEvent.groupBy({
      by: ['rendition'],
      _count: true,
      _sum: { bytes: true },
      where: { createdAt: { gte: from }, imageId: { not: null } },
    }),
  ]);

  const [imageRows, videoRows] = await Promise.all([
    prisma.image.findMany({
      where: {
        id: {
          in: groupedImages
            .map((row) => row.imageId)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: { id: true, originalName: true },
    }),
    prisma.video.findMany({
      where: {
        id: {
          in: groupedVideos
            .map((row) => row.videoId)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: { id: true, originalName: true },
    }),
  ]);

  const imageNames = new Map(imageRows.map((row) => [row.id, row.originalName]));
  const videoNames = new Map(videoRows.map((row) => [row.id, row.originalName]));
  const dayBuckets = new Map<string, { events: number; bytes: number }>();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + index);
    dayBuckets.set(date.toISOString().slice(0, 10), { events: 0, bytes: 0 });
  }
  for (const row of rawGroupedDays) {
    const bucket = dayBuckets.get(row.day);
    if (!bucket) continue;
    bucket.events += Number(row.events) || 0;
    bucket.bytes += Number(row.bytes) || 0;
  }

  // Aggregate the recorded cache statuses. `hit:memory` and `hit:disk` count as
  // cache hits (their bytes never touched origin); `miss` counts as a miss.
  let memoryHits = 0;
  let diskHits = 0;
  let genericHits = 0;
  let missEvents = 0;
  let savedBytes = 0;
  for (const row of groupedCache as Array<{
    rendition: string | null;
    _count: number;
    _sum: { bytes: number | null };
  }>) {
    const count = Number(row._count) || 0;
    const bytes = Number(row._sum?.bytes) || 0;
    if (row.rendition === 'miss') {
      missEvents += count;
      continue;
    }
    if (row.rendition === 'hit:memory') memoryHits += count;
    else if (row.rendition === 'hit:disk') diskHits += count;
    else genericHits += count;
    savedBytes += bytes;
  }
  const cachedEvents = memoryHits + diskHits + genericHits;
  const cacheTotal = cachedEvents + missEvents;
  const hitRatio =
    cacheTotal > 0 ? Number(((cachedEvents / cacheTotal) * 100).toFixed(1)) : 0;

  const formatAssetDisplayName = (id: string | null | undefined): string => {
    if (!id || id === 'null' || id === 'undefined' || id.trim() === '') {
      return 'Direct CDN Asset (Cached)';
    }
    if (id.includes('.') || id.includes('/')) {
      return id.split('/').pop() || id;
    }
    return `Archived Asset (${id.slice(0, 8)})`;
  };

  const result: DeliveryAnalytics = {
    range: { days, from: from.toISOString() },
    totals: {
      events: totalAggregate._count,
      bytes: totalAggregate._sum.bytes || 0,
    },
    images: {
      events: imageAggregate._count,
      bytes: imageAggregate._sum.bytes || 0,
    },
    videos: {
      events: videoAggregate._count,
      bytes: videoAggregate._sum.bytes || 0,
      ranges: videoAggregate._count,
    },
    cache: {
      hitRatio,
      cachedEvents,
      missEvents,
      memoryHits,
      diskHits,
      savedBytes,
    },
    byDay: Array.from(dayBuckets.entries()).map(([day, value]) => ({ day, ...value })),
    topImages: groupedImages.map((row) => {
      const id = row.imageId || '';
      return {
        id: id || 'direct',
        originalName: imageNames.get(id) || formatAssetDisplayName(id),
        events: row._count,
        bytes: row._sum.bytes || 0,
        cached: true,
      };
    }),
    topVideos: groupedVideos.map((row) => {
      const id = row.videoId || '';
      return {
        id: id || 'video',
        originalName: videoNames.get(id) || formatAssetDisplayName(id),
        events: row._count,
        bytes: row._sum.bytes || 0,
      };
    }),
    referrers: groupedReferrers.map((row) => ({
      origin: row.referer!,
      events: row._count,
    })),
  };

  deliveryAnalyticsCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + DELIVERY_CACHE_TTL_MS,
  });

  return result;
}
