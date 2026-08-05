/**
 * In-memory sliding-window rate limiter.
 *
 * Kept dependency-free so it runs identically in Edge middleware and in
 * Node. Buckets live per process/isolate — good enough for a self-hosted
 * single-node deployment; document that a shared store (Redis) would be
 * needed for multi-instance scaling.
 */

export interface RateLimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

/** Which paths/methods get rate limited, and how aggressively. */
export function getRateLimitRule(
  pathname: string,
  method: string
): RateLimitRule | null {
  // CPU/memory-heavy on-the-fly image processing.
  // The serve limit is generous because gallery thumbnails route through it.
  if (pathname.startsWith('/api/serve')) {
    return { key: 'serve', limit: 300, windowMs: 60_000 };
  }
  // Legacy Cloudinary-URL redirects (can fan out to transforms) — same
  // budget as serve since the redirect target route does the heavy lifting.
  if (pathname.startsWith('/api/redirect')) {
    return { key: 'redirect', limit: 300, windowMs: 60_000 };
  }
  if (pathname.endsWith('/transform') && method === 'GET') {
    return { key: 'transform', limit: 120, windowMs: 60_000 };
  }
  // Write endpoints (single + bulk delete share a bucket)
  if (pathname === '/api/upload' && method === 'POST') {
    return { key: 'upload', limit: 30, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/images') && method === 'DELETE') {
    return { key: 'images-delete', limit: 60, windowMs: 60_000 };
  }
  if (pathname === '/api/reset' && method === 'DELETE') {
    return { key: 'reset', limit: 10, windowMs: 60_000 };
  }
  // Brute-force protection for the login endpoint
  if (pathname === '/api/auth/login' && method === 'POST') {
    return { key: 'login', limit: 10, windowMs: 60_000 };
  }
  return null;
}

const buckets = new Map<string, number[]>();

export function checkRateLimit(
  ip: string,
  rule: RateLimitRule,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const bucketKey = `${rule.key}:${ip}`;
  let timestamps = buckets.get(bucketKey) ?? [];

  // Drop timestamps outside the window
  timestamps = timestamps.filter((t) => now - t < rule.windowMs);

  if (timestamps.length >= rule.limit) {
    buckets.set(bucketKey, timestamps);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((timestamps[0] + rule.windowMs - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(bucketKey, timestamps);

  // Opportunistic cleanup so the map never grows unbounded
  if (buckets.size > 10_000) {
    for (const [key, ts] of buckets) {
      if (ts.length === 0 || now - ts[ts.length - 1] > rule.windowMs * 2) {
        buckets.delete(key);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Reset all buckets (primarily for tests). */
export function resetRateLimits(): void {
  buckets.clear();
}
