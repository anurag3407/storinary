import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitRule } from '@/lib/rate-limit';
import { isClerkEnabled } from '@/lib/auth-config';

function getSessionToken(request: NextRequest): string | null {
  if (isClerkEnabled()) {
    return (
      request.cookies.get('__session')?.value ||
      request.cookies.get('__client_uat')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      null
    );
  }

  return (
    request.cookies.get('__Secure-storinary.session_token')?.value ||
    request.cookies.get('storinary.session_token')?.value ||
    request.cookies.get('__Secure-storinary-session_token')?.value ||
    request.cookies.get('storinary-session_token')?.value ||
    null
  );
}

const PROTECTED_PAGES = ['/upload', '/gallery', '/videos', '/settings', '/onboarding'];
const PUBLIC_API = [
  /^\/api\/health$/, // uptime / deployment smoke checks
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

async function applyRateLimitAndRouteAuth(
  request: NextRequest,
  clerkUserId?: string | null,
  forwardHeaders?: Headers
): Promise<NextResponse> {
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
    const isAuthenticated = clerkUserId
      ? true
      : Boolean(getSessionToken(request));

    if (!isAuthenticated) {
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

  if (forwardHeaders) {
    return NextResponse.next({
      request: {
        headers: forwardHeaders,
      },
    });
  }

  return NextResponse.next();
}

interface ClerkJwtPayload {
  sub?: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
  exp?: number;
}

function parseClerkJwt(token: string): ClerkJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as ClerkJwtPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  let clerkUserId: string | null = null;
  let authHeaders: Headers | undefined;

  if (isClerkEnabled()) {
    const sessionToken =
      request.cookies.get('__session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (sessionToken) {
      const claims = parseClerkJwt(sessionToken);
      if (claims?.sub) {
        clerkUserId = claims.sub;
        authHeaders = new Headers(request.headers);
        authHeaders.set('x-clerk-auth-user-id', claims.sub);
        if (claims.org_id) authHeaders.set('x-clerk-auth-org-id', claims.org_id);
        if (claims.org_role) authHeaders.set('x-clerk-auth-org-role', claims.org_role);
        if (claims.org_slug) authHeaders.set('x-clerk-auth-org-slug', claims.org_slug);
      }
    }
  }

  return applyRateLimitAndRouteAuth(request, clerkUserId, authHeaders);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, images, icons, CSS, and JS chunks
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
