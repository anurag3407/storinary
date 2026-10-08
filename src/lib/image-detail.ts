import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { serializeImageVersion } from '@/lib/asset-versions';
import { generateLinks, serializeImage } from '@/lib/utils';
import type { ImageDetailResponse } from '@/types';

/**
 * Raised when the image could not be read for an infrastructure reason (for
 * example the database is unreachable). Callers should treat this as a
 * server error rather than a missing asset — a `null` return is the only
 * signal that the image genuinely does not exist.
 */
export class ImageDetailError extends Error {
  status = 500;
  constructor(message = 'Could not load image') {
    super(message);
    this.name = 'ImageDetailError';
  }
}

/**
 * Fetch a single image and its generated links.
 *
 * @returns the image detail, or `null` when no image with that id exists.
 * @throws {ImageDetailError} when the lookup fails for an infrastructure reason.
 */
export const getImageDetail = cache(async (id: string): Promise<ImageDetailResponse | null> => {
  let image;
  try {
    image = await prisma.image.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        metadata: { include: { field: { select: { externalId: true } } } },
      },
    });
  } catch (error) {
    console.error(`Failed to query image ${id}:`, error);
    throw new ImageDetailError('The database is unavailable.');
  }

  if (!image) return null;

  const links = generateLinks(
    image.publicUrl,
    image.storagePath,
    image.altText,
    process.env.NEXT_PUBLIC_APP_URL || ''
  );

  return {
    image: serializeImage(image),
    versions: image.versions.map(serializeImageVersion),
    links,
  };
});
