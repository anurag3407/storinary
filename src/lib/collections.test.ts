import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToCollection, removeFromCollection } from './collections';

const { collectionDeleteMany, collectionFindUnique, itemCreateMany, imageFindMany, videoFindMany } =
  vi.hoisted(() => ({
    collectionDeleteMany: vi.fn(),
    collectionFindUnique: vi.fn(),
    itemCreateMany: vi.fn(),
    imageFindMany: vi.fn(),
    videoFindMany: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    collection: {
      findUnique: collectionFindUnique,
      delete: vi.fn(),
      update: vi.fn(),
    },
    collectionItem: {
      createMany: itemCreateMany,
      deleteMany: collectionDeleteMany,
    },
    image: { findMany: imageFindMany },
    video: { findMany: videoFindMany },
  },
}));

describe('collection membership', () => {
  beforeEach(() => {
    collectionDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    collectionFindUnique.mockReset().mockResolvedValue({ id: 'collection-1' });
    itemCreateMany.mockReset().mockResolvedValue({ count: 2 });
    imageFindMany.mockReset().mockResolvedValue([{ id: 'image-1' }]);
    videoFindMany.mockReset().mockResolvedValue([{ id: 'video-1' }]);
  });

  it('replaces matching memberships when adding assets', async () => {
    const result = await addToCollection('collection-1', ['image-1'], ['video-1']);

    expect(result.ok).toBe(true);
    expect(collectionDeleteMany).toHaveBeenCalledWith({
      where: {
        collectionId: 'collection-1',
        OR: [
          { imageId: { in: ['image-1'] } },
          { videoId: { in: ['video-1'] } },
        ],
      },
    });
    expect(itemCreateMany).toHaveBeenCalledWith({
      data: [
        { collectionId: 'collection-1', imageId: 'image-1' },
        { collectionId: 'collection-1', videoId: 'video-1' },
      ],
    });
  });

  it('rejects missing assets and unknown collections before writing', async () => {
    const empty = await addToCollection('collection-1', [], []);
    expect(empty.ok).toBe(false);
    expect(itemCreateMany).not.toHaveBeenCalled();

    collectionFindUnique.mockResolvedValueOnce(null);
    const missing = await addToCollection('missing', ['image-1'], []);
    expect(missing.ok).toBe(false);
    expect(itemCreateMany).not.toHaveBeenCalled();
  });

  it('removes exact asset memberships', async () => {
    const result = await removeFromCollection('collection-1', ['image-1'], []);
    expect(result.ok).toBe(true);
    expect(collectionDeleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'collection-1', OR: [{ imageId: { in: ['image-1'] } }, { videoId: { in: [] } }] },
    });
  });
});
