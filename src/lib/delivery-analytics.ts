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
  bytes?: number;
  referer: string | null;
  userAgent: string | null;
}): Promise<void> {
  await prisma.deliveryEvent.create({
    data: {
      imageId: input.imageId,
      videoId: null,
      rendition: null,
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

export type DeliveryAnalytics = {
  range: { days: number; from: string };
  totals: { events: number; bytes: number };
  images: { events: number; bytes: number };
  videos: { events: number; bytes: number; ranges: number };
  byDay: Array<{ day: string; events: number; bytes: number }>;
  topImages: Array<{ id: string; originalName: string; events: number; bytes: number }>;
  topVideos: Array<{ id: string; originalName: string; events: number; bytes: number }>;
  referrers: Array<{ origin: string; events: number }>;
};

export async function getDeliveryAnalytics(daysInput = 30): Promise<DeliveryAnalytics> {
  const days = Math.min(MAX_DAYS, Math.max(1, Number.isFinite(daysInput) ? daysInput : 30));
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

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
          SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS events, COALESCE(SUM("bytes"), 0)::int AS bytes
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
    date.setDate(date.getDate() + index);
    dayBuckets.set(date.toISOString().slice(0, 10), { events: 0, bytes: 0 });
  }
  for (const row of rawGroupedDays) {
    const bucket = dayBuckets.get(row.day);
    if (!bucket) continue;
    bucket.events += Number(row.events) || 0;
    bucket.bytes += Number(row.bytes) || 0;
  }

  return {
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
    byDay: Array.from(dayBuckets.entries()).map(([day, value]) => ({ day, ...value })),
    topImages: groupedImages.map((row) => ({
      id: row.imageId!,
      originalName: imageNames.get(row.imageId!) || 'Deleted asset',
      events: row._count,
      bytes: row._sum.bytes || 0,
    })),
    topVideos: groupedVideos.map((row) => ({
      id: row.videoId!,
      originalName: videoNames.get(row.videoId!) || 'Deleted asset',
      events: row._count,
      bytes: row._sum.bytes || 0,
    })),
    referrers: groupedReferrers.map((row) => ({
      origin: row.referer!,
      events: row._count,
    })),
  };
}
