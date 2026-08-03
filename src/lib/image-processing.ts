import sharp from 'sharp';
import type { TransformParams } from '@/types';

/**
 * Extract metadata from an image buffer.
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: buffer.length,
  };
}

/**
 * Apply transformations to an image buffer.
 *
 * @param buffer - Source image buffer
 * @param params - Transformation parameters from URL query string
 * @returns Transformed image buffer and its content type
 */
export async function transformImage(
  buffer: Buffer,
  params: TransformParams
): Promise<{ buffer: Buffer; contentType: string; format: string }> {
  let pipeline = sharp(buffer);

  // ── Resize ───────────────────────────────────────────
  if (params.w || params.h) {
    pipeline = pipeline.resize({
      width: params.w || undefined,
      height: params.h || undefined,
      fit: params.fit || 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    });
  }

  // ── Format Conversion + Quality ──────────────────────
  const quality = params.q || 80;
  const outputFormat = params.fmt || 'webp';

  switch (outputFormat) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true, progressive: true });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 4 });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality, effort: 4 });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality });
      break;
    default:
      pipeline = pipeline.webp({ quality, effort: 4 });
  }

  const resultBuffer = await pipeline.toBuffer();

  const contentTypeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    png: 'image/png',
  };

  return {
    buffer: resultBuffer,
    contentType: contentTypeMap[outputFormat] || 'image/webp',
    format: outputFormat,
  };
}

/**
 * Optimize an image for upload (server-side fallback if client didn't compress).
 * Strips metadata, auto-orients, converts to WebP.
 */
export async function optimizeForUpload(
  buffer: Buffer,
  maxWidth: number = 4096
): Promise<{ buffer: Buffer; format: string; contentType: string }> {
  const metadata = await sharp(buffer).metadata();
  let pipeline = sharp(buffer).rotate(); // auto-orient based on EXIF

  // Resize if wider than maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const resultBuffer = await pipeline.webp({ quality: 85, effort: 4 }).toBuffer();

  return {
    buffer: resultBuffer,
    format: 'webp',
    contentType: 'image/webp',
  };
}
