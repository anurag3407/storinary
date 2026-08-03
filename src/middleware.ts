import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { checkRateLimit, getRateLimitRule } from '@/lib/rate-limit';

/**
 * Edge middleware that provides:
 *  1. Rate limiting for expensive/abusive endpoints (serve, transform,
 *     upload, bulk delete, reset, login).
 *  2. Session auth when STORINARY_ADMIN_PASSWORD is configured: write APIs
 *     return 401, app pages redirect to /login.
 */

const PROTECTED_PAGES = ['/', '/upload', '/gallery', '/settings'];

function isProtectedPage(pathname: string): boolean {
  if (pathname.startsWith('/images')) return true;
  return PROTECTED_PAGES.some(
    (page) => pathname === page || (page !== '/' && pathname.startsWith(page))
  );
}

function isProtectedWriteApi(pathname: string, method: string): boolean {
  if (method !== 'POST' && method !== 'DELETE' && method !== 'PATCH') {
    return false;
  }
  if (pathname === '/api/upload' || pathname === '/api/reset') return true;
  if (pathname === '/api/images' || pathname.startsWith('/api/images/')) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Rate limiting ────────────────────────────────────────────
  const rule = getRateLimitRule(pathname, method);
  if (rule) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
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
      // Mutating APIs → 401 so the UI can prompt for login
      if (isProtectedWriteApi(pathname, method)) {
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
