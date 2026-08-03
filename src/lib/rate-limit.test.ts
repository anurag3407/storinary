// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { checkRateLimit, getRateLimitRule, resetRateLimits } from './rate-limit';

const MINUTE = 60_000;

describe('getRateLimitRule', () => {
  it('returns a rule for serve requests', () => {
    const rule = getRateLimitRule('/api/serve/2024/01/a.webp', 'GET');
    expect(rule?.key).toBe('serve');
  });

  it('returns a rule for transform requests', () => {
    const rule = getRateLimitRule('/api/images/img-1/transform', 'GET');
    expect(rule?.key).toBe('transform');
  });

  it('returns a rule for uploads, deletes, resets, and login', () => {
    expect(getRateLimitRule('/api/upload', 'POST')?.key).toBe('upload');
    expect(getRateLimitRule('/api/images', 'DELETE')?.key).toBe('images-delete');
    expect(getRateLimitRule('/api/reset', 'DELETE')?.key).toBe('reset');
    expect(getRateLimitRule('/api/auth/login', 'POST')?.key).toBe('login');
  });

  it('returns null for unlisted paths/methods', () => {
    expect(getRateLimitRule('/api/images', 'GET')).toBeNull();
    expect(getRateLimitRule('/api/stats', 'GET')).toBeNull();
    expect(getRateLimitRule('/upload', 'GET')).toBeNull();
    expect(getRateLimitRule('/api/upload', 'GET')).toBeNull();
  });
});

describe('checkRateLimit', () => {
  afterEach(() => resetRateLimits());

  it('allows requests up to the limit, then blocks', () => {
    const rule = { key: 'serve', limit: 3, windowMs: MINUTE };
    const now = 1_000_000;

    expect(checkRateLimit('1.2.3.4', rule, now).allowed).toBe(true);
    expect(checkRateLimit('1.2.3.4', rule, now).allowed).toBe(true);
    expect(checkRateLimit('1.2.3.4', rule, now).allowed).toBe(true);

    const blocked = checkRateLimit('1.2.3.4', rule, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks buckets per IP', () => {
    const rule = { key: 'serve', limit: 1, windowMs: MINUTE };
    expect(checkRateLimit('10.0.0.1', rule).allowed).toBe(true);
    expect(checkRateLimit('10.0.0.1', rule).allowed).toBe(false);
    expect(checkRateLimit('10.0.0.2', rule).allowed).toBe(true);
  });

  it('refills after the window elapses', () => {
    const rule = { key: 'serve', limit: 1, windowMs: MINUTE };
    const start = 1_000_000;
    expect(checkRateLimit('5.6.7.8', rule, start).allowed).toBe(true);
    expect(checkRateLimit('5.6.7.8', rule, start).allowed).toBe(false);
    // 61 seconds later the first request is outside the window
    expect(checkRateLimit('5.6.7.8', rule, start + MINUTE + 1_000).allowed).toBe(true);
  });
});
