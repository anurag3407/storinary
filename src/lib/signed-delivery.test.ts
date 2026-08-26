// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSignedTransformImageUrl,
  buildSignedPosterUrl,
  buildSignedVideoStreamUrl,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  MAX_SIGNED_URL_TTL_SECONDS,
  MIN_SIGNED_URL_TTL_SECONDS,
  createSignedUrlToken,
  isSignedDeliveryEnabled,
  normalizeSignedUrlTtl,
  verifySignedUrlToken,
} from './signed-delivery';

describe('signed delivery tokens', () => {
  beforeEach(() => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';
  });

  afterEach(() => {
    delete process.env.STORINARY_ADMIN_PASSWORD;
    delete process.env.STORINARY_SIGNED_URL_SECRET;
  });

  it('is disabled without a dedicated secret or admin password', () => {
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.STORINARY_ADMIN_PASSWORD;
    expect(isSignedDeliveryEnabled()).toBe(false);
  });

  it('creates and verifies a path-bound expiring token', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const token = createSignedUrlToken('images/photo.webp', Math.floor(now / 1000) + 60, now);

    expect(verifySignedUrlToken('images/photo.webp', token, now)).toBe(true);
    expect(verifySignedUrlToken('images/other.webp', token, now)).toBe(false);
    expect(verifySignedUrlToken('images/photo.webp', token, now + 61_000)).toBe(false);
  });

  it('clamps requested lifetimes to safe bounds', () => {
    expect(normalizeSignedUrlTtl(1)).toBe(MIN_SIGNED_URL_TTL_SECONDS);
    expect(normalizedTtl(Number.NaN)).toBe(DEFAULT_SIGNED_URL_TTL_SECONDS);
    expect(normalizeSignedUrlTtl(String(MAX_SIGNED_URL_TTL_SECONDS * 2))).toBe(MAX_SIGNED_URL_TTL_SECONDS);
  });
});

describe('signed delivery URL builders', () => {
  const request = new Request('https://app.example/images/image-1');
  const image = {
    id: 'image-1',
    publicUrl: 'https://cdn.example/photo.webp',
    storagePath: 'images/photo.webp',
  };

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.STORINARY_ADMIN_PASSWORD;
  });

  it('binds transform links to the original storage path token', () => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';

    const transformed = buildSignedTransformImageUrl(request, image, 60, { w: '200', q: '70' });

    const url = new URL(transformed);
    const token = url.searchParams.get('token');
    url.searchParams.delete('token');

    expect(url.pathname).toBe('/api/serve/images/photo.webp');
    expect(Object.fromEntries(url.searchParams)).toEqual({ w: '200', q: '70' });
    expect(verifySignedUrlToken(image.storagePath, token)).toBe(true);
    expect(verifySignedUrlToken('images/other.webp', token)).toBe(false);
  });

  it('uses relative id-based transforms without signing and appends tokens when enabled', () => {
    delete process.env.STORINARY_ADMIN_PASSWORD;
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildSignedTransformImageUrl(request, image, 60, { w: '300' })).toBe(
      '/api/images/image-1/transform?w=300'
    );

    process.env.NEXT_PUBLIC_APP_URL = 'https://media.example/';
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';
    const signed = new URL(buildSignedTransformImageUrl(request, image, 60));
    expect(signed.origin).toBe('https://media.example');
    expect(verifySignedUrlToken(image.storagePath, signed.searchParams.get('token'))).toBe(true);
  });
});

describe('signed video URL builders', () => {
  const request = new Request('https://app.example/videos/video-1');

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.STORINARY_ADMIN_PASSWORD;
  });

  it('returns relative public links when signing is disabled', () => {
    delete process.env.STORINARY_SIGNED_URL_SECRET;
    delete process.env.STORINARY_ADMIN_PASSWORD;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(buildSignedVideoStreamUrl(request, 'video-1', 60, '720p')).toBe(
      'https://app.example/api/videos/video-1/stream?rendition=720p'
    );
    expect(buildSignedPosterUrl(request, 'video-1', 60)).toBe('/api/videos/video-1/poster');
  });

  it('binds stream and poster tokens to their delivery paths', () => {
    process.env.STORINARY_SIGNED_URL_SECRET = 'test-signing-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://media.example';

    const stream = new URL(buildSignedVideoStreamUrl(request, 'video-1', 60, '720p'));
    const poster = new URL(buildSignedPosterUrl(request, 'video-1', 60)!);

    expect(stream.pathname).toBe('/api/videos/video-1/stream');
    expect(stream.searchParams.get('rendition')).toBe('720p');
    expect(poster.pathname).toBe('/api/videos/video-1/poster');
    expect(verifySignedUrlToken('/api/videos/video-1/stream', stream.searchParams.get('token'))).toBe(true);
    expect(verifySignedUrlToken('/api/videos/video-1/poster', poster.searchParams.get('token'))).toBe(true);
    expect(verifySignedUrlToken('/api/videos/video-2/stream', stream.searchParams.get('token'))).toBe(false);
  });
});

function normalizedTtl(input: number) {
  return normalizeSignedUrlTtl(input);
}
