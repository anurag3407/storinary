/**
 * Eager transform generation — pre-generate common image variants at upload
 * time so the first request for a transformed size is already cached on the
 * CDN.  Variants are stored in Supabase alongside the original with a naming
 * convention: {baseKey}_thumb.webp, {baseKey}_medium.webp, {baseKey}_large.webp
 */

import sharp from 'sharp';
import { uploadToStorage, getPublicUrl } from './storage';

export interface EagerVariant {
  /** Human-readable label (thumb, medium, large). */
  label: string;
  /** Target width in pixels. */
  width: number;
  /** Storage path of the variant inside the Supabase bucket. */
  storageKey: string;
  /** Public CDN URL for the variant. */
  publicUrl: string;
}

/** Pre-defined variant sizes. Only variants SMALLER than the original are generated. */
const VARIANT_SIZES = [
  { label: 'thumb', width: 200 },
  { label: 'medium', width: 800 },
  { label: 'large', width: 1600 },
] as const;

/**
 * Generate eager transform variants for a freshly uploaded image.
 *
 * Each variant is a WebP encoded with quality 82 (good balance of size/quality).
 * SVGs and GIFs are skipped — resizing an SVG is meaningless and GIF animation
 * would be lost.
 *
 * Variants are generated concurrently and uploaded in parallel to Supabase.
 * This is intentionally fire-and-forget from the caller's perspective —
 * the upload response is sent immediately; variants populate in the background.
 */
export async function generateEagerTransforms(
  buffer: Buffer,
  baseStorageKey: string, // e.g. "2024/08/photo-abc12345.webp"
  format: string,
): Promise<EagerVariant[]> {
  // Skip eager transforms for formats that don't benefit or break
  if (format === 'svg' || format === 'gif') {
    return [];
  }

  // Check original dimensions so we don't upscale
  let origWidth = 0;
  try {
    const metadata = await sharp(buffer).metadata();
    origWidth = metadata.width || 0;
  } catch {
    return []; // corrupted / unreadable image — skip
  }

  const baseWithoutExt = baseStorageKey.replace(/\.[^.]+$/, '');

  // Generate all applicable variants in parallel
  const variantPromises = VARIANT_SIZES
    .filter((v) => v.width < origWidth)
    .map(async (variant): Promise<EagerVariant> => {
      const result = await sharp(buffer)
        .resize({ width: variant.width, withoutEnlargement: true, kernel: 'lanczos3' })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();

      const variantKey = `${baseWithoutExt}_${variant.label}.webp`;

      await uploadToStorage(result, variantKey, 'image/webp');
      const publicUrl = getPublicUrl(variantKey);

      return {
        label: variant.label,
        width: variant.width,
        storageKey: variantKey,
        publicUrl,
      };
    });

  const results = await Promise.allSettled(variantPromises);

  // Return only successfully generated variants
  return results
    .filter((r): r is PromiseFulfilledResult<EagerVariant> => r.status === 'fulfilled')
    .map((r) => r.value);
}
