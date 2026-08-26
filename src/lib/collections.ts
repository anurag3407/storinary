import { prisma } from '@/lib/prisma';

const MAX_ASSETS_PER_REQUEST = 100;

const COLLECTION_INCLUDE = {
  items: {
    include: {
      image: {
        select: {
          id: true,
          originalName: true,
          publicUrl: true,
          storagePath: true,
          folder: true,
          createdAt: true,
        },
      },
      video: {
        select: {
          id: true,
          originalName: true,
          posterPath: true,
          duration: true,
          folder: true,
          createdAt: true,
        },
      },
    },
    orderBy: { id: 'desc' as const },
  },
};

export type CollectionRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    image?: {
      id: string;
      originalName: string;
      publicUrl: string;
      storagePath: string;
      folder: string;
      createdAt: Date | string;
    };
    video?: {
      id: string;
      originalName: string;
      posterPath: string | null;
      duration: number;
      folder: string;
      createdAt: Date | string;
    };
  }>;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function getCollection(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    include: COLLECTION_INCLUDE,
  });
}

export async function updateCollection(
  id: string,
  input: { name?: string; description?: string }
): Promise<Result<unknown>> {
  if (input.name !== undefined && !input.name) {
    return { ok: false, status: 400, error: 'Collection name cannot be empty' };
  }
  try {
    return {
      ok: true,
      data: await prisma.collection.update({
        where: { id },
        data: input,
        include: COLLECTION_INCLUDE,
      }),
    };
  } catch {
    return { ok: false, status: 404, error: 'Collection not found or duplicate name' };
  }
}

export async function deleteCollection(id: string): Promise<boolean> {
  try {
    await prisma.collection.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function addToCollection(
  collectionId: string,
  imageIds: string[],
  videoIds: string[]
): Promise<Result<unknown>> {
  if (imageIds.length + videoIds.length > MAX_ASSETS_PER_REQUEST) {
    return { ok: false, status: 400, error: `Maximum ${MAX_ASSETS_PER_REQUEST} assets per request` };
  }
  if (imageIds.length === 0 && videoIds.length === 0) {
    return { ok: false, status: 400, error: 'No asset IDs provided' };
  }

  const [images, videos, collectionExists] = await Promise.all([
    prisma.image.findMany({ where: { id: { in: imageIds } }, select: { id: true } }),
    prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true } }),
    prisma.collection.findUnique({ where: { id: collectionId }, select: { id: true } }),
  ]);
  if (!collectionExists) return { ok: false, status: 404, error: 'Collection not found' };

  await prisma.collectionItem.deleteMany({
    where: { collectionId, OR: [
      { imageId: { in: images.map((image) => image.id) } },
      { videoId: { in: videos.map((video) => video.id) } },
    ] },
  });
  await prisma.collectionItem.createMany({
    data: [
      ...images.map((image) => ({ collectionId, imageId: image.id })),
      ...videos.map((video) => ({ collectionId, videoId: video.id })),
    ],
  });
  return { ok: true, data: await getCollection(collectionId) };
}

export async function removeFromCollection(
  collectionId: string,
  imageIds: string[],
  videoIds: string[]
): Promise<Result<unknown>> {
  if (imageIds.length + videoIds.length > MAX_ASSETS_PER_REQUEST) {
    return { ok: false, status: 400, error: `Maximum ${MAX_ASSETS_PER_REQUEST} assets per request` };
  }
  if (imageIds.length === 0 && videoIds.length === 0) {
    return { ok: false, status: 400, error: 'No asset IDs provided' };
  }

  await prisma.collectionItem.deleteMany({
    where: { collectionId, OR: [{ imageId: { in: imageIds } }, { videoId: { in: videoIds } }] },
  });
  return { ok: true, data: await getCollection(collectionId) };
}
