import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { checkRateLimit, getRateLimitRule } from '@/lib/rate-limit';

/**
 * Edge middleware that provides:
 *  1. Rate limiting for expensive/abusive endpoints (serve, transform,
 *     upload, delete, reset, login).
 *  2. Session auth when STORINARY_ADMIN_PASSWORD is configured: every API
 *     route except the public CDN surface (/api/serve and the transform
 *     endpoint) and the auth endpoints requires a valid session; app pages
 *     redirect to /login.
 */

const PROTECTED_PAGES = ['/', '/upload', '/gallery', '/settings'];

function isProtectedPage(pathname: string): boolean {
  if (pathname.startsWith('/images')) return true;
  return PROTECTED_PAGES.some(
    (page) => pathname === page || (page !== '/' && pathname.startsWith(page))
  );
}

/** APIs that must stay open: auth endpoints + the public CDN surface. */
function isPublicApi(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/serve') ||
    pathname.endsWith('/transform')
  );
}

/** Any non-public API requires a session when auth is enabled. */
function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith('/api/') && !isPublicApi(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Rate limiting ────────────────────────────────────────────
  const rule = getRateLimitRule(pathname, method);
  if (rule) {
    // Prefer the value set by a trusted reverse proxy; otherwise take the
    // rightmost XFF hop (appended by the proxy) rather than the
    // client-spoofable leftmost value.
    const ip =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    const { allowed, retryAfterSeconds } = checkRateLimit(ip, rule);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }
  }

  // ── Authentication ───────────────────────────────────────────
  if (isAuthEnabled()) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const authenticated = token ? await verifySessionToken(token) : false;

    if (!authenticated) {
      // Any protected API (list, detail, stats, upload, delete, reset) → 401
      if (isProtectedApi(pathname)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // App pages → redirect to the login page
      if (isProtectedPage(pathname)) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico).*)'],
};
