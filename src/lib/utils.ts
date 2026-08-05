import { nanoid } from 'nanoid';
import type { Image } from '@prisma/client';
import type { GeneratedLinks, ImageRecord, TransformParams } from '@/types';

/**
 * Generate a short unique ID (8 characters).
 */
export function generateShortId(): string {
  return nanoid(8);
}

/**
 * Generate all link formats for an image.
 */
export function generateLinks(
  publicUrl: string,
  storagePath: string,
  altText: string,
  appUrl: string
): GeneratedLinks {
  const transformBase = `${appUrl}/api/serve/${storagePath}`;

  return {
    direct: publicUrl,
    html: `<img src="${publicUrl}" alt="${altText || 'image'}" loading="lazy" />`,
    markdown: `![${altText || 'image'}](${publicUrl})`,
    css: `background-image: url('${publicUrl}');`,
    transformBase,
  };
}

/**
 * Serialize a Prisma Image row into the API-facing ImageRecord shape
 * (ISO-8601 strings for dates).
 */
export function serializeImage(image: Image): ImageRecord {
  return {
    id: image.id,
    originalName: image.originalName,
    storagePath: image.storagePath,
    publicUrl: image.publicUrl,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    format: image.format,
    mimeType: image.mimeType,
    folder: image.folder,
    tags: image.tags,
    altText: image.altText,
    bgRemoved: image.bgRemoved,
    compressed: image.compressed,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

/**
 * Parse transform query parameters from URL search params.
 */
export function parseTransformParams(
  searchParams: URLSearchParams
): {
  w?: number;
  h?: number;
  q?: number;
  fmt?: 'jpeg' | 'webp' | 'avif' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
} {
  const params: Record<string, unknown> = {};

  const w = searchParams.get('w');
  if (w) params.w = Math.min(Math.max(parseInt(w, 10), 1), 8192);

  const h = searchParams.get('h');
  if (h) params.h = Math.min(Math.max(parseInt(h, 10), 1), 8192);

  const q = searchParams.get('q');
  if (q) params.q = Math.min(Math.max(parseInt(q, 10), 1), 100);

  const fmt = searchParams.get('fmt');
  if (fmt && ['jpeg', 'webp', 'avif', 'png'].includes(fmt)) {
    params.fmt = fmt;
  }

  const fit = searchParams.get('fit');
  if (fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
    params.fit = fit;
  }

  return params as {
    w?: number;
    h?: number;
    q?: number;
    fmt?: 'jpeg' | 'webp' | 'avif' | 'png';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
}

/**
 * Build a URL for the on-the-fly transform endpoint for a storage path.
 * Falls back to a relative URL when NEXT_PUBLIC_APP_URL is unset.
 */
export function generateServeUrl(
  storagePath: string,
  params?: Partial<TransformParams>
): string {
  const cleanPath = storagePath.replace(/^\//, '');
  const prefix = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL || '');
  const base = `${prefix}/api/serve/${cleanPath}`;
  if (!params) return base;

  const qs = new URLSearchParams();
  if (params.w) qs.set('w', String(params.w));
  if (params.h) qs.set('h', String(params.h));
  if (params.q) qs.set('q', String(params.q));
  if (params.fmt) qs.set('fmt', params.fmt);
  if (params.fit) qs.set('fit', params.fit);
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Get MIME type from file extension.
 */
export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
