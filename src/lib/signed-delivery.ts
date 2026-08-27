import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNING_SECRET_NAME = 'STORINARY_SIGNED_URL_SECRET';
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
export const MIN_SIGNED_URL_TTL_SECONDS = 60;
export const MAX_SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSigningSecret(): string {
  return process.env[SIGNING_SECRET_NAME] || '';
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isSignedDeliveryEnabled(): boolean {
  return Boolean(getSigningSecret());
}

export function createSignedUrlToken(
  storagePath: string,
  expiresAtSeconds: number,
  nowMs = Date.now()
): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('Signed delivery is not configured');
  const payload = `${storagePath}:${expiresAtSeconds}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  const issuedAt = Math.floor(nowMs / 1000).toString(36);
  return `${expiresAtSeconds.toString(36)}.${issuedAt}.${signature}`;
}

export function verifySignedUrlToken(
  storagePath: string,
  token: string | null,
  nowMs = Date.now()
): boolean {
  const parts = token?.split('.') ?? [];
  if (parts.length !== 3) return false;
  const [expiresPart, , signature] = parts;
  if (!/^[0-9a-z]+$/i.test(expiresPart)) return false;
  const expiresAtSeconds = Number.parseInt(expiresPart, 36);
  if (!Number.isFinite(expiresAtSeconds)) return false;
  if (expiresAtSeconds * 1000 <= nowMs) return false;
  const expected = createSignedUrlToken(storagePath, expiresAtSeconds, nowMs).split('.')[2];
  return constantTimeEqual(signature, expected);
}

export function normalizeSignedUrlTtl(input: unknown): number {
  const parsed = typeof input === 'number' ? input : Number.parseInt(String(input), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Math.min(MAX_SIGNED_URL_TTL_SECONDS, Math.max(MIN_SIGNED_URL_TTL_SECONDS, Math.floor(parsed)));
}

export function buildSignedImageUrl(
  request: Request,
  image: { publicUrl: string; storagePath: string },
  ttlSeconds: number,
  transforms?: Record<string, string>
): string {
  const query = new URLSearchParams(transforms);
  if (!isSignedDeliveryEnabled()) {
    const publicQuery = query.toString();
    return publicQuery ? `${image.publicUrl}?${publicQuery}` : image.publicUrl;
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const token = createSignedUrlToken(image.storagePath, Math.floor(Date.now() / 1000) + ttlSeconds);
  query.set('token', token);
  const signedQuery = query.toString();

  return `${origin.replace(/\/+$/, '')}/api/serve/${image.storagePath}?${signedQuery}`;
}

export function buildSignedTransformImageUrl(
  request: Request,
  image: { publicUrl: string; storagePath: string; id?: string },
  ttlSeconds: number,
  transforms: Record<string, string> = {}
): string {
  const query = new URLSearchParams(transforms);

  if (!isSignedDeliveryEnabled()) {
    const transformQuery = query.toString();
    return transformQuery
      ? `/api/images/${image.id}/transform?${transformQuery}`
      : `/api/images/${image.id}/transform`;
  }

  const token = createSignedUrlToken(image.storagePath, Math.floor(Date.now() / 1000) + ttlSeconds);
  query.set('token', token);
  const signedQuery = query.toString();

  return `${(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
    /\/+$/,
    ''
  )}/api/serve/${image.storagePath}?${signedQuery}`;
}

function isPublicDeliveryEnabled() {
  return !isSignedDeliveryEnabled();
}

export function buildSignedVideoStreamUrl(
  request: Request,
  videoId: string,
  ttlSeconds: number,
  renditionLabel?: string
): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const path = `/api/videos/${videoId}/stream`;
  void ttlSeconds;
  if (isPublicDeliveryEnabled()) {
    const publicQuery = renditionLabel ? `?rendition=${encodeURIComponent(renditionLabel)}` : '';
    return `${origin.replace(/\/+$/, '')}${path}${publicQuery}`;
  }
  const token = createSignedUrlToken(path, Math.floor(Date.now() / 1000) + ttlSeconds);
  const query = new URLSearchParams({ token });
  if (renditionLabel) query.set('rendition', renditionLabel);
  return `${origin.replace(/\/+$/, '')}${path}?${query}`;
}

export function buildSignedPosterUrl(
  request: Request,
  videoId: string,
  ttlSeconds: number
): string | null {
  if (!isSignedDeliveryEnabled()) {
    return `/api/videos/${videoId}/poster`;
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const path = `/api/videos/${videoId}/poster`;
  const token = createSignedUrlToken(path, Math.floor(Date.now() / 1000) + ttlSeconds);
  return `${origin.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
}
