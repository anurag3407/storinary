// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';

const { imageMock } = vi.hoisted(() => ({
  imageMock: {
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: imageMock,
  },
}));

describe('GET /api/stats', () => {
  beforeEach(() => {
    imageMock.count.mockReset();
    imageMock.aggregate.mockReset();
    imageMock.groupBy.mockReset();
    imageMock.findMany.mockReset();
  });

  it('returns aggregated stats', async () => {
    imageMock.count.mockResolvedValue(10);
    imageMock.aggregate.mockResolvedValue({ _sum: { fileSize: 2048 } });
    imageMock.groupBy
      .mockResolvedValueOnce([{ format: 'webp', _count: 8 }])
      .mockResolvedValueOnce([{ folder: '/', _count: 10 }]);
    imageMock.findMany.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalImages).toBe(10);
    expect(body.totalStorageBytes).toBe(2048);
    expect(body.totalStorageFormatted).toBe('2 KB');
    expect(body.imagesByFormat).toEqual({ webp: 8 });
    expect(body.imagesByFolder).toEqual({ '/': 10 });
    expect(body.uploadsThisMonth).toBe(10);
    expect(body.supabaseBucket).toBe('storinary');
    expect(imageMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('handles zero storage gracefully', async () => {
    imageMock.count.mockResolvedValue(0);
    imageMock.aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });
    imageMock.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    imageMock.findMany.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(body.totalStorageFormatted).toBe('0 B');
    expect(body.imagesByFormat).toEqual({});
  });
});
