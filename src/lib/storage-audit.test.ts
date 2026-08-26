import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditOrphanedStorage, deleteOrphanedStorage } from './storage-audit';

const prisma = vi.hoisted(() => ({
  image: { findMany: vi.fn() },
  video: { findMany: vi.fn() },
  videoRendition: { findMany: vi.fn() },
}));

const storage = vi.hoisted(() => ({
  listStorageObjects: vi.fn(),
  bulkDeleteFromStorage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/storage', () => storage);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.image.findMany.mockResolvedValue([{ storagePath: 'image.webp' }]);
  prisma.video.findMany.mockResolvedValue([
    { storagePath: 'video.mp4', posterPath: null },
    { storagePath: 'second.mp4', posterPath: 'poster.webp' },
  ]);
  prisma.videoRendition.findMany.mockResolvedValue([{ storagePath: 'rendition.mp4' }]);
});

describe('auditOrphanedStorage', () => {
  it('identifies only objects absent from every database path', async () => {
    storage.listStorageObjects.mockResolvedValue({
      objects: [
        { key: 'image.webp', size: 1, lastModified: new Date('2026-01-01') },
        { key: 'orphan.webp', size: 2, lastModified: new Date('2026-01-02') },
      ],
      nextOffset: undefined,
    });

    const result = await auditOrphanedStorage(0);
    expect(result).toEqual({
      scanned: 2,
      orphans: [{ key: 'orphan.webp', size: 2, lastModified: '2026-01-02T00:00:00.000Z' }],
    });
  });

  it('continues bounded pagination and returns a resumable offset', async () => {
    storage.listStorageObjects
      .mockResolvedValueOnce({
        objects: [{ key: 'a', size: 0, lastModified: new Date(0) }],
        nextOffset: 500,
      })
      .mockResolvedValueOnce({ objects: [], nextOffset: undefined });

    const result = await auditOrphanedStorage(0);
    expect(storage.listStorageObjects).toHaveBeenNthCalledWith(2, undefined, 500, 500);
    expect(result.scanned).toBe(1);
    expect(result.nextOffset).toBeUndefined();
  });
});

describe('deleteOrphanedStorage', () => {
  it('rechecks references before deleting unique keys', async () => {
    await deleteOrphanedStorage(['orphan.webp', 'orphan.webp']);
    expect(storage.bulkDeleteFromStorage).toHaveBeenCalledWith(['orphan.webp']);
  });

  it('refuses to delete keys referenced by the database', async () => {
    const result = await deleteOrphanedStorage(['image.webp']);
    expect(result.deleted).toBe(0);
    expect(storage.bulkDeleteFromStorage).not.toHaveBeenCalled();
  });

  it('enforces the deletion batch cap', async () => {
    await expect(deleteOrphanedStorage(Array.from({ length: 201 }, (_, index) => `key-${index}`))).rejects.toThrow(
      'Maximum 200 objects per delete request'
    );
  });
});
