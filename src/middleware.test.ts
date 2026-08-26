// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { resetRateLimits } from '@/lib/rate-limit';

const { isAuthEnabledMock, verifySessionTokenMock, getRateLimitRuleMock } =
  vi.hoisted(() => ({
    isAuthEnabledMock: vi.fn(),
    verifySessionTokenMock: vi.fn(),
    getRateLimitRuleMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  isAuthEnabled: isAuthEnabledMock,
  verifySessionToken: verifySessionTokenMock,
  SESSION_COOKIE: 'storinary_session',
}));

// Keep the real sliding-window limiter (integration) but stub which rules
// apply so tests can use tiny limits without firing hundreds of requests.
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    getRateLimitRule: getRateLimitRuleMock,
  };
});

function makeRequest(
  path: string,
  init?: { method?: string; headers?: Record<string, string> }
) {
  return new NextRequest(`http://localhost${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
  });
}

describe('middleware', () => {
  beforeEach(() => {
    resetRateLimits();
    isAuthEnabledMock.mockReset().mockReturnValue(false);
    verifySessionTokenMock.mockReset().mockResolvedValue(false);
    getRateLimitRuleMock.mockReset().mockReturnValue(null);
  });

  it('passes everything through when auth is disabled', async () => {
    const res = await middleware(
      makeRequest('/api/upload', { method: 'POST' })
    );
    expect(res.status).toBe(200);
  });

  // ── Rate limiting ─────────────────────────────────────────────
  describe('rate limiting', () => {
    it('returns 429 with Retry-After once the limit is exceeded', async () => {
      getRateLimitRuleMock.mockReturnValue({
        key: 'serve',
        limit: 1,
        windowMs: 60_000,
      });
      const headers = { 'x-forwarded-for': '10.0.0.1' };

      const first = await middleware(makeRequest('/api/serve/a.webp', { headers }));
      expect(first.status).toBe(200);

      const blocked = await middleware(makeRequest('/api/serve/a.webp', { headers }));
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('retry-after')).toBeTruthy();
      expect(await blocked.json()).toEqual({ error: 'Too many requests' });
    });

    it('allows requests again after the window elapses', async () => {
      getRateLimitRuleMock.mockReturnValue({
        key: 'serve',
        limit: 1,
        windowMs: 60_000,
      });
      const headers = { 'x-forwarded-for': '10.0.0.1' };

      await middleware(makeRequest('/api/serve/a.webp', { headers }));
      const blocked = await middleware(makeRequest('/api/serve/a.webp', { headers }));
      expect(blocked.status).toBe(429);
    });

    it('tracks limits per IP', async () => {
      getRateLimitRuleMock.mockReturnValue({
        key: 'serve',
        limit: 1,
        windowMs: 60_000,
      });

      await middleware(
        makeRequest('/api/serve/a.webp', { headers: { 'x-forwarded-for': '10.0.0.1' } })
      );
      const blocked = await middleware(
        makeRequest('/api/serve/a.webp', { headers: { 'x-forwarded-for': '10.0.0.1' } })
      );
      expect(blocked.status).toBe(429);

      const other = await middleware(
        makeRequest('/api/serve/a.webp', { headers: { 'x-forwarded-for': '10.0.0.2' } })
      );
      expect(other.status).toBe(200);
    });

    it('uses x-real-ip when present, else the rightmost XFF hop', async () => {
      getRateLimitRuleMock.mockReturnValue({
        key: 'serve',
        limit: 1,
        windowMs: 60_000,
      });

      await middleware(
        makeRequest('/api/serve/a.webp', {
          headers: {
            'x-real-ip': '9.9.9.9',
            'x-forwarded-for': '1.1.1.1, 2.2.2.2',
          },
        })
      );
      // Same x-real-ip → same bucket → blocked
      const blocked = await middleware(
        makeRequest('/api/serve/a.webp', {
          headers: {
            'x-real-ip': '9.9.9.9',
            'x-forwarded-for': '3.3.3.3',
          },
        })
      );
      expect(blocked.status).toBe(429);
      // Different x-real-ip → fresh bucket
      const other = await middleware(
        makeRequest('/api/serve/a.webp', {
          headers: { 'x-real-ip': '8.8.8.8' },
        })
      );
      expect(other.status).toBe(200);
    });

    it('does not rate limit paths without a rule', async () => {
      const res = await middleware(makeRequest('/api/stats'));
      expect(res.status).toBe(200);
      expect(getRateLimitRuleMock).toHaveBeenCalledWith('/api/stats', 'GET');
    });
  });

  // ── Authentication ────────────────────────────────────────────
  describe('authentication', () => {
    beforeEach(() => {
      isAuthEnabledMock.mockReturnValue(true);
    });

    it('rejects protected GET APIs with 401 when unauthenticated', async () => {
      for (const path of ['/api/images?page=1', '/api/stats', '/api/images/img-1']) {
        const res = await middleware(makeRequest(path));
        expect(res.status, path).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
      }
    });

    it('defers credentialed media uploads to route-level authentication', async () => {
      const res = await middleware(makeRequest('/api/upload', { method: 'POST' }));
      expect(res.status).toBe(200);

      const videos = await middleware(makeRequest('/api/videos', { method: 'POST' }));
      expect(videos.status).toBe(200);
    });

    it('leaves the public CDN surface and auth endpoints open', async () => {
      const serve = await middleware(
        makeRequest('/api/serve/2024/01/a.webp?w=100')
      );
      expect(serve.status).toBe(200);

      const transform = await middleware(
        makeRequest('/api/images/img-1/transform?w=100')
      );
      expect(transform.status).toBe(200);

      const login = await middleware(
        makeRequest('/api/auth/login', { method: 'POST' })
      );
      expect(login.status).toBe(200);
    });

    it('redirects protected pages to /login with a next param', async () => {
      const res = await middleware(makeRequest('/upload'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost/login?next=%2Fupload'
      );
    });

    it('redirects the root path with next=%2F', async () => {
      const res = await middleware(makeRequest('/'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost/login?next=%2F'
      );
    });

    it('redirects image detail pages too', async () => {
      const res = await middleware(makeRequest('/images/img-1'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost/login?next=%2Fimages%2Fimg-1'
      );
    });

    it('does not redirect the login page itself', async () => {
      const res = await middleware(makeRequest('/login'));
      expect(res.status).toBe(200);
    });

    it('allows access with a valid session cookie', async () => {
      verifySessionTokenMock.mockResolvedValue(true);
      const res = await middleware(
        makeRequest('/api/stats', {
          headers: { cookie: 'storinary_session=valid-token' },
        })
      );
      expect(res.status).toBe(200);
      expect(verifySessionTokenMock).toHaveBeenCalledWith('valid-token');
    });

    it('rejects a present-but-invalid token', async () => {
      const res = await middleware(
        makeRequest('/api/stats', {
          headers: { cookie: 'storinary_session=bad-token' },
        })
      );
      expect(res.status).toBe(401);
    });

    it('still allows public assets and APIs for unauthenticated users', async () => {
      verifySessionTokenMock.mockResolvedValue(false);
      const res = await middleware(
        makeRequest('/api/serve/2024/01/a.webp', {})
      );
      expect(res.status).toBe(200);
    });
  });
});
