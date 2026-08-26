import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteEmptyFolder, listFolders, normalizeFolderPath, renameFolder } from './folders';

const prisma = vi.hoisted(() => ({
  image: {
    groupBy: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  video: {
    groupBy: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeFolderPath', () => {
  it('creates safe absolute paths', () => {
    expect(normalizeFolderPath('/products///spring/')).toBe('/products/spring');
    expect(normalizeFolderPath('products\\spring')).toBe('/products/spring');
    expect(normalizeFolderPath('/../secret')).toBeNull();
    expect(normalizeFolderPath('/')).toBeNull();
  });
});

describe('listFolders', () => {
  it('merges image and video folder counts', async () => {
    prisma.image.groupBy.mockResolvedValue([
      { folder: '/shared', _count: 2 },
      { folder: '/images-only', _count: 1 },
    ]);
    prisma.video.groupBy.mockResolvedValue([{ folder: '/shared', _count: 3 }]);

    await expect(listFolders()).resolves.toEqual([
      { path: '/images-only', imageCount: 1, videoCount: 0 },
      { path: '/shared', imageCount: 2, videoCount: 3 },
    ]);
  });
});

describe('folder operations', () => {
  it('renames virtual folders across images and videos', async () => {
    prisma.image.updateMany.mockResolvedValue({ count: 4 });
    prisma.video.updateMany.mockResolvedValue({ count: 2 });

    await expect(renameFolder('/old', '/new')).resolves.toEqual({
      ok: true,
      status: 200,
      renamedImages: 4,
      renamedVideos: 2,
    });
  });

  it('refuses to delete non-empty folders', async () => {
    prisma.image.count.mockResolvedValue(0);
    prisma.video.count.mockResolvedValue(1);

    const result = await deleteEmptyFolder('/videos');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not empty');
  });
});
