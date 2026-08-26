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
  params: TransformParams,
  overlay?: Buffer
): Promise<{ buffer: Buffer; contentType: string; format: string }> {
  let width = params.w;
  let height = params.h;
  if (params.dpr && (width || height)) {
    width = width ? Math.min(Math.round(width * params.dpr), 8192) : undefined;
    height = height ? Math.min(Math.round(height * params.dpr), 8192) : undefined;
  }
  if (params.ar && (!width || !height)) {
    const [left, right] = params.ar.split(':').map(Number.parseFloat);
    if (Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0) {
      if (!width && height) width = Math.round((height * left) / right);
      else if (!height && width) height = Math.round((width * right) / left);
    }
  }

  let pipeline = sharp(buffer);

  // ── Resize + crop ─────────────────────────────────────
  if (width || height || params.ar) {
    const fit = params.fit === 'thumb' ? 'cover' : params.fit === 'limit' ? 'inside' : params.fit || 'inside';
    pipeline = pipeline.resize({
      width,
      height,
      fit: fit as 'cover' | 'contain' | 'fill' | 'inside' | 'outside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
      background: parseBackgroundColor(params.b),
      ...(fit === 'cover' || fit === 'contain'
        ? { position: gravityPosition(params.g ?? 'center') }
        : {}),
    });
  }

  if (params.a) pipeline = pipeline.rotate(params.a);

  for (const effect of params.e ?? []) {
    if (effect.grayscale) pipeline = pipeline.grayscale();
    else if (effect.sepia !== undefined)
      pipeline = pipeline.recomb([
        [0.393, 0.769, 0.189],
        [0.349, 0.686, 0.168],
        [0.272, 0.534, 0.131],
      ]);
    else if (effect.blur !== undefined) pipeline = pipeline.blur(Math.max(0.3, effect.blur / 100));
    else if (effect.sharpen !== undefined) pipeline = pipeline.sharpen({ sigma: Math.min(10, effect.sharpen / 10) });
    else if (effect.saturation !== undefined) pipeline = pipeline.modulate({ saturation: effect.saturation });
  }

  pipeline = pipeline.modulate({
    ...(params.brightness !== undefined ? { brightness: params.brightness } : {}),
  });
  if (params.contrast !== undefined) pipeline = pipeline.linear(params.contrast, 128 - params.contrast * 128);
  if (params.gamma !== undefined) pipeline = pipeline.gamma(params.gamma);

  if (params.text) {
    const metadata = await sharp(buffer).metadata();
    const canvasWidth = width || metadata.width || height || 800;
    const fontSize = Math.max(
      12,
      Math.min(160, Math.round(Math.min(canvasWidth || 800, height || canvasWidth || 800) / 14))
    );
    const textOverlay = await sharp({
      text: {
        text: escapePangoText(params.text),
        font: 'sans',
        rgba: true,
        dpi: Math.round(fontSize * 72 / 16),
        wrap: 'word',
      },
    }).png().toBuffer();

    pipeline = pipeline.composite([{ input: textOverlay, gravity: overlayGravity(params.g ?? 'center') }]);
  }

  if (overlay) {
    pipeline = pipeline.composite([{ input: overlay, gravity: overlayGravity(params.g ?? 'center') }]);
  }

  // ── Format Conversion + Quality ──────────────────────
  const quality = params.q === 'auto' ? 80 : params.q || 80;
  const outputFormat = params.fmt === 'auto' ? 'webp' : params.fmt || 'webp';

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

function escapePangoText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseBackgroundColor(background?: string): { r: number; g: number; b: number; alpha?: number } | undefined {
  if (!background) return undefined;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(background);
  if (hex) {
    const value = hex[1];
    const expanded =
      value.length === 3
        ? value.split('').map((char) => char + char).join('')
        : value;
    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
    };
  }
  const colors: Record<string, { r: number; g: number; b: number }> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
  };
  return colors[background.toLowerCase()];
}

function gravityPosition(
  gravity: NonNullable<TransformParams['g']>
): string | number {
  switch (gravity) {
    case 'north': return 'top';
    case 'south': return 'bottom';
    case 'east': return 'right';
    case 'west': return 'left';
    case 'auto':
    case 'face':
    case 'faces':
      return sharp.strategy.attention;
    default: return 'centre';
  }
}

function overlayGravity(gravity: NonNullable<TransformParams['g']>): 'north' | 'south' | 'east' | 'west' | 'center' {
  return gravity === 'north' ? 'north'
    : gravity === 'south' ? 'south'
    : gravity === 'east' ? 'east'
    : gravity === 'west' ? 'west'
    : 'center';
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

export async function createVideoPoster(buffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  format: string;
}> {
  const resultBuffer = await sharp(buffer)
    .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { buffer: resultBuffer, contentType: 'image/webp', format: 'webp' };
}
