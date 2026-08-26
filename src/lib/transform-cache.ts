/**
 * In-memory LRU cache for on-the-fly image transforms.
 *
 * Repeated requests for the same path + params skip the Supabase download
 * and the sharp processing pass entirely. Bounded by both entry count and
 * total bytes so a self-hosted box cannot be OOM'd by a cache.
 *
 * NOTE: caches are per process/instance. Pair with the `CDN-Cache-Control`
 * header so edge caches absorb the long tail.
 */

import type { TransformParams } from '@/types';

export interface CachedTransform {
  buffer: Buffer;
  contentType: string;
}

/** Canonical cache key from the storage path + normalized transform params. */
export function transformCacheKey(
  storageKey: string,
  params: TransformParams
): string {
  const qs = new URLSearchParams();
  if (params.w) qs.set('w', String(params.w));
  if (params.h) qs.set('h', String(params.h));
  if (params.q) qs.set('q', String(params.q));
  if (params.fmt) qs.set('fmt', params.fmt);
  if (params.fit) qs.set('fit', params.fit);
  if (params.g) qs.set('g', params.g);
  if (params.ar) qs.set('ar', params.ar);
  if (params.b) qs.set('b', params.b);
  if (typeof params.a === 'number') qs.set('a', String(params.a));
  if (params.e?.length) qs.set('e', params.e.map(serializeEffect).join(','));
  if (params.brightness !== undefined) qs.set('brightness', String(params.brightness));
  if (params.contrast !== undefined) qs.set('contrast', String(params.contrast));
  if (params.gamma !== undefined) qs.set('gamma', String(params.gamma));
  if (params.dpr) qs.set('dpr', String(params.dpr));
  if (params.t) qs.set('t', params.t);
  if (params.text) qs.set('text', params.text);
  if (params.overlayId) qs.set('overlay', params.overlayId);
  const query = qs.toString();
  return query ? `${storageKey}?${query}` : storageKey;
}

function serializeEffect(effect: NonNullable<TransformParams['e']>[number]): string {
  if (effect.grayscale) return 'grayscale';
  if (effect.sepia !== undefined) return `sepia:${effect.sepia}`;
  if (effect.blur !== undefined) return `blur:${effect.blur}`;
  if (effect.sharpen !== undefined) return `sharpen:${effect.sharpen}`;
  return `saturation:${Math.round((effect.saturation ?? 1) * 100)}`;
}

export class TransformCache {
  private map = new Map<string, CachedTransform>();
  private bytes = 0;

  constructor(
    private readonly maxEntries = 50,
    private readonly maxBytes = 64 * 1024 * 1024 // 64 MB
  ) {}

  get(key: string): CachedTransform | undefined {
    const value = this.map.get(key);
    if (!value) return undefined;
    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: CachedTransform): void {
    if (this.map.has(key)) {
      const old = this.map.get(key)!;
      this.bytes -= old.buffer.length;
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.bytes += value.buffer.length;
    this.evict();
  }

  /** Stats for observability/tests. */
  stats(): { entries: number; bytes: number } {
    return { entries: this.map.size, bytes: this.bytes };
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }

  private evict(): void {
    while (
      this.map.size > this.maxEntries ||
      (this.bytes > this.maxBytes && this.map.size > 1)
    ) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey)!;
      this.bytes -= oldest.buffer.length;
      this.map.delete(oldestKey);
    }
  }
}

const defaultMaxEntries = parseInt(
  process.env.STORINARY_TRANSFORM_CACHE_ENTRIES || '50',
  10
) || 50;
const defaultMaxBytes =
  (parseInt(process.env.STORINARY_TRANSFORM_CACHE_MB || '64', 10) || 64) *
  1024 *
  1024;

/** Shared cache instance used by the serve + transform routes. */
export const transformCache = new TransformCache(
  defaultMaxEntries,
  defaultMaxBytes
);
