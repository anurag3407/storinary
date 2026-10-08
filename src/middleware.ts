import { NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { checkRateLimit, getRateLimitRule } from '@/lib/rate-limit';
import { isClerkEnabled, hasClerkPublishableKey } from '@/lib/auth-config';

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

const clerkHandler =
  isClerkEnabled() && hasClerkPublishableKey()
    ? clerkMiddleware(async (auth, req) => {
        try {
          const authObj = await auth();
          const authHeaders = new Headers(req.headers);
          if (authObj?.userId) {
            authHeaders.set('x-clerk-auth-user-id', authObj.userId);
            if (authObj.orgId) authHeaders.set('x-clerk-auth-org-id', authObj.orgId);
            if (authObj.orgRole) authHeaders.set('x-clerk-auth-org-role', authObj.orgRole);
            if (authObj.orgSlug) authHeaders.set('x-clerk-auth-org-slug', authObj.orgSlug);
          }
          return applyRateLimitAndRouteAuth(req, authObj?.userId, authHeaders);
        } catch {
          return applyRateLimitAndRouteAuth(req);
        }
      })
    : null;

const safeFetchEvent = {
  waitUntil: (promise: Promise<unknown>) => {
    void promise.catch(() => {});
  },
};

export async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  if (clerkHandler) {
    const clerkRes = await clerkHandler(request, safeFetchEvent as never);
    return (clerkRes || NextResponse.next()) as NextResponse;
  }
  return applyRateLimitAndRouteAuth(request);
}

export const config = { matcher: ['/((?!_next|favicon\\.ico).*)'] };
