import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDeliveryAnalytics,
  invalidateDeliveryAnalyticsCache,
  recordImageDelivery,
  recordVideoDelivery,
} from './delivery-analytics';

const prisma = vi.hoisted(() => ({
  deliveryEvent: {
    create: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  image: { findMany: vi.fn() },
  video: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma }));

beforeEach(() => {
  vi.clearAllMocks();
  invalidateDeliveryAnalyticsCache();
  prisma.image.findMany.mockResolvedValue([{ id: 'img', originalName: 'image.png' }]);
  prisma.video.findMany.mockResolvedValue([{ id: 'vid', originalName: 'video.mp4' }]);
});

describe('delivery recording', () => {
  it('stores bounded image metadata', async () => {
    prisma.deliveryEvent.create.mockResolvedValue({});
    await recordImageDelivery({
      imageId: 'img',
      kind: 'transform',
      bytes: 12.4,
      referer: 'https://example.com/page?secret=1',
      userAgent: 'Test/1.0',
    });

    expect(prisma.deliveryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageId: 'img',
        kind: 'image:transform',
        bytes: 12,
        referer: 'https://example.com',
      }),
    });
  });

  it('distinguishes video renditions', async () => {
    await recordVideoDelivery({
      videoId: 'vid',
      label: '720p',
      bytes: -5,
      referer: null,
      userAgent: null,
    });

    expect(prisma.deliveryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rendition: '720p', kind: 'video:rendition', bytes: 0 }),
    });
  });
});

describe('getDeliveryAnalytics', () => {
  it('returns normalized totals and daily buckets', async () => {
    vi.useFakeTimers({ now: new Date('2026-08-25T12:00:00.000Z') });
    prisma.deliveryEvent.aggregate
      .mockResolvedValueOnce({ _count: 3, _sum: { bytes: 30 } })
      .mockResolvedValueOnce({ _count: 2, _sum: { bytes: 20 } })
      .mockResolvedValueOnce({ _count: 1, _sum: { bytes: 10 } });
    prisma.$queryRaw.mockResolvedValue([{ day: '2026-08-24', events: 3, bytes: 30 }]);
    prisma.deliveryEvent.groupBy
      .mockResolvedValueOnce([
        { imageId: 'img', _count: 2, _sum: { bytes: 20 } },
      ])
      .mockResolvedValueOnce([
        { videoId: 'vid', _count: 1, _sum: { bytes: 10 } },
      ])
      .mockResolvedValueOnce([
        { referer: 'https://example.com', _count: 3 },
      ])
      .mockResolvedValueOnce([
        { rendition: 'hit:memory', _count: 2, _sum: { bytes: 20 } },
        { rendition: 'miss', _count: 1, _sum: { bytes: 10 } },
      ]);

    const result = await getDeliveryAnalytics(1);
    vi.useRealTimers();
    expect(result.totals).toEqual({ events: 3, bytes: 30 });
    expect(result.images).toEqual({ events: 2, bytes: 20 });
    expect(result.videos).toEqual({ events: 1, bytes: 10, ranges: 1 });
    expect(result.byDay).toHaveLength(1);
    expect(result.byDay[0].events).toBe(3);
    expect(result.byDay[0].bytes).toBe(30);
    expect(result.topImages[0].originalName).toBe('image.png');
    expect(result.topVideos[0].originalName).toBe('video.mp4');
  });

  it('reports real cache metrics derived from recorded statuses', async () => {
    prisma.deliveryEvent.aggregate.mockResolvedValue({ _count: 0, _sum: { bytes: 0 } });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.deliveryEvent.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { rendition: 'hit:memory', _count: 3, _sum: { bytes: 300 } },
        { rendition: 'hit:disk', _count: 1, _sum: { bytes: 100 } },
        { rendition: 'miss', _count: 4, _sum: { bytes: 400 } },
      ]);

    const result = await getDeliveryAnalytics(7);

    expect(result.cache.hitRatio).toBe(50);
    expect(result.cache.memoryHits).toBe(3);
    expect(result.cache.diskHits).toBe(1);
    expect(result.cache.missEvents).toBe(4);
    expect(result.cache.savedBytes).toBe(400);
  });

  it('reports a zero hit ratio when no delivery events exist', async () => {
    prisma.deliveryEvent.aggregate.mockResolvedValue({ _count: 0, _sum: { bytes: 0 } });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.deliveryEvent.groupBy.mockResolvedValue([]);

    const result = await getDeliveryAnalytics();

    expect(result.cache.hitRatio).toBe(0);
    expect(result.cache.cachedEvents).toBe(0);
    expect(result.cache.missEvents).toBe(0);
  });
});
