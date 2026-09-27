import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { checkRateLimit, getRateLimitRule } from '@/lib/rate-limit';

const PROTECTED_PAGES = ['/', '/upload', '/gallery', '/videos', '/settings', '/onboarding'];
const PUBLIC_API = [
  /^\/api\/auth\//,
  /^\/api\/serve\//,
  /^\/api\/redirect\//,
  /^\/api\/v1\//,
  /^\/api\/v1_1\//,
  /^\/api\/videos(?:\/|$)/,
  /^\/api\/upload(?:\/|$)/,
  /\/transform(?:\/|$)/,
  /^\/[^/]+\/(?:image|video)\/(?:upload|fetch)\//,
];

function isProtectedPage(pathname: string): boolean {
  return (
    PROTECTED_PAGES.some(
      (page) => pathname === page || (page !== '/' && pathname.startsWith(`${page}/`))
    ) || pathname.startsWith('/images/')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = getRateLimitRule(pathname, request.method);
  if (rule) {
    const ip =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    const { allowed, retryAfterSeconds } = checkRateLimit(ip, rule);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }
  }

  if (!PUBLIC_API.some((pattern) => pattern.test(pathname))) {
    // Optimistic redirect only. Every API route still validates the Better
    // Auth session, email verification, membership, and active organization.
    const sessionCookie = getSessionCookie(request, { cookiePrefix: 'storinary' });
    if (!sessionCookie) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (isProtectedPage(pathname)) {
        const url = new URL('/login', request.url);
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon\\.ico).*)'] };
