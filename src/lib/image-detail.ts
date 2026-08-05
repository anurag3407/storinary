import { prisma } from '@/lib/prisma';
import { generateLinks, serializeImage } from '@/lib/utils';
import type { ImageDetailResponse } from '@/types';

/**
 * Helper to fetch a single image and its generated links directly from the DB.
 */
export async function getImageDetail(id: string): Promise<ImageDetailResponse | null> {
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) return null;

  const links = generateLinks(
    image.publicUrl,
    image.storagePath,
    image.altText,
    process.env.NEXT_PUBLIC_APP_URL || ''
  );

  return {
    image: serializeImage(image),
    links,
  };
}
