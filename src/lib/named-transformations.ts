import { parseTransformParams } from '@/lib/utils';
import type { TransformEffect, TransformGravity } from '@/types';

export type NamedTransformationRecord = {
  id: string;
  name: string;
  params: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_KEYS = [
  'w', 'h', 'q', 'fmt', 'fit', 'g', 'ar', 'b', 'a', 'e',
  'brightness', 'contrast', 'gamma', 'dpr',
  'text',
  'overlay',
] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export function parseNamedTransformation(body: unknown): {
  name: string;
  params: string;
  active: boolean;
} {
  const source = (body ?? {}) as Record<string, unknown>;
  const name = typeof source.name === 'string'
    ? source.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
    : '';
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) throw new Error('Name must use letters, numbers, dashes, or underscores');

  if (!source.params || typeof source.params !== 'object' || Array.isArray(source.params)) {
    throw new Error('Transform parameters are required');
  }

  const searchParams = new URLSearchParams();
  for (const [rawKey, rawValue] of Object.entries(source.params as Record<string, unknown>)) {
    const key = rawKey as AllowedKey;
    if (!ALLOWED_KEYS.includes(key) || typeof rawValue !== 'string') continue;
    searchParams.set(key, rawValue);
  }
  const query = searchParams.toString();
  if (!query) throw new Error('At least one valid transform parameter is required');

  return { name, params: query, active: source.active !== false };
}

export function namedTransformationSummary(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

export function validateNamedTransformationParams(query: string): boolean {
  const parsed = parseTransformParams(new URLSearchParams(query));
  return Boolean(
    parsed.w || parsed.h || parsed.q || (parsed.fmt && parsed.fmt !== 'auto') ||
    parsed.fit || parsed.g || parsed.ar || parsed.b || typeof parsed.a === 'number' ||
    parsed.e?.length || parsed.brightness !== undefined ||
    parsed.contrast !== undefined || parsed.gamma !== undefined || parsed.dpr
    || Boolean(parsed.text) || Boolean(parsed.overlayId)
  );
}

export type { TransformEffect, TransformGravity };
