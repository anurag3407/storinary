import { imageSize } from 'image-size';
import type sharpType from 'sharp';
import type { TransformParams } from '@/types';

let sharpInstance: typeof sharpType | null = null;
let sharpChecked = false;

async function getSharp(): Promise<typeof sharpType | null> {
  if (sharpChecked) return sharpInstance;
  sharpChecked = true;
  try {
    const mod = await import('sharp');
    sharpInstance = (mod.default || mod) as typeof sharpType;
  } catch {
    sharpInstance = null;
  }
  return sharpInstance;
}

/**
 * Extract metadata from an image buffer.
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  // 1. Pure-JS header parsing (works on all runtimes without native binaries)
  try {
    const dimensions = imageSize(buffer);
    if (dimensions && dimensions.width && dimensions.height) {
      return {
        width: dimensions.width,
        height: dimensions.height,
        format: dimensions.type || 'unknown',
        size: buffer.length,
      };
    }
  } catch {
    // imageSize could not parse format, fallback
  }

  // 2. Fall back to sharp if available
  const sharp = await getSharp();
  if (sharp) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: buffer.length,
      };
    } catch {
      // sharp could not parse format, fallback
    }
  }

  // 3. Fallback for SVG or unparseable buffers
  const str = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000));
  if (str.includes('<svg')) {
    return {
      width: 800,
      height: 600,
      format: 'svg',
      size: buffer.length,
    };
  }

  return {
    width: 0,
    height: 0,
    format: 'unknown',
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
  overlay?: Buffer,
  acceptHeader?: string | null
): Promise<{ buffer: Buffer; contentType: string; format: string; isAutoFormat: boolean }> {
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

  const sharp = await getSharp();
  if (!sharp) {
    const isAutoFormat = params.fmt === 'auto';
    const outputFormat = isAutoFormat
      ? negotiateFormat(acceptHeader, params.fmt)
      : (params.fmt || 'webp');
    const contentType = `image/${outputFormat}`;
    return {
      buffer,
      contentType,
      format: outputFormat,
      isAutoFormat,
    };
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

  // ── Corner radius / rounded avatar masking ───────────
  if (params.r) {
    const intermediateBuffer = await pipeline.toBuffer();
    const meta = await sharp(intermediateBuffer).metadata();
    const maskW = meta.width || width || 800;
    const maskH = meta.height || height || 800;
    const maxRadius = Math.round(Math.min(maskW, maskH) / 2);
    const radius =
      params.r === 'max'
        ? maxRadius
        : Math.min(Math.max(parseInt(params.r, 10) || 0, 1), maxRadius);

    if (radius > 0) {
      const maskSvg = Buffer.from(
        `<svg width="${maskW}" height="${maskH}"><rect x="0" y="0" width="${maskW}" height="${maskH}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
      );
      pipeline = sharp(intermediateBuffer).composite([{ input: maskSvg, blend: 'dest-in' }]);
    } else {
      pipeline = sharp(intermediateBuffer);
    }
  }

  // ── Format Conversion + Quality ──────────────────────
  const isAutoFormat = params.fmt === 'auto';
  let outputFormat = isAutoFormat
    ? negotiateFormat(acceptHeader, params.fmt)
    : (params.fmt || 'webp');
  if (params.r && outputFormat === 'jpeg' && !params.fmt) {
    outputFormat = 'webp';
  }
  const quality = negotiateQuality(params.q, outputFormat);

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
    isAutoFormat,
  };
}

/**
 * Negotiates the best image format based on client Accept header and requested format.
 */
export function negotiateFormat(
  acceptHeader?: string | null,
  requestedFmt?: string
): 'avif' | 'webp' | 'jpeg' | 'png' {
  if (requestedFmt && requestedFmt !== 'auto') {
    if (['avif', 'webp', 'jpeg', 'png'].includes(requestedFmt)) {
      return requestedFmt as 'avif' | 'webp' | 'jpeg' | 'png';
    }
  }

  const accept = (acceptHeader || '').toLowerCase();
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpeg';
}

/**
 * Maps perceptual quality based on target format and requested quality.
 * Emulates Cloudinary q_auto heuristics.
 */
export function negotiateQuality(
  qParam?: number | string,
  outputFormat: string = 'webp'
): number {
  if (typeof qParam === 'number' && !isNaN(qParam)) {
    return Math.min(Math.max(qParam, 1), 100);
  }

  const qStr = typeof qParam === 'string' ? qParam.toLowerCase() : 'auto';

  if (qStr === 'auto:eco' || qStr === 'auto:low') {
    switch (outputFormat) {
      case 'avif': return 50;
      case 'webp': return 65;
      case 'png': return 70;
      case 'jpeg': default: return 70;
    }
  }

  if (qStr === 'auto:best') {
    switch (outputFormat) {
      case 'avif': return 80;
      case 'webp': return 88;
      case 'png': return 95;
      case 'jpeg': default: return 90;
    }
  }

  // Default 'auto' or 'auto:good'
  switch (outputFormat) {
    case 'avif': return 65;
    case 'webp': return 78;
    case 'png': return 80;
    case 'jpeg': default: return 82;
  }
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
      return sharpInstance?.strategy?.attention ?? 'centre';
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
  const sharp = await getSharp();
  if (!sharp) {
    const meta = await getImageMetadata(buffer);
    return {
      buffer,
      format: meta.format || 'jpeg',
      contentType: meta.format ? `image/${meta.format}` : 'image/jpeg',
    };
  }
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
  const sharp = await getSharp();
  if (!sharp) {
    return { buffer, contentType: 'image/jpeg', format: 'jpeg' };
  }
  const resultBuffer = await sharp(buffer)
    .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { buffer: resultBuffer, contentType: 'image/webp', format: 'webp' };
}
