import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  isAuthEnabled,
  safeEqual,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTS,
} from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/login — exchange the admin password for a session cookie.
 * Returns 404 when auth is not enabled (STORINARY_ADMIN_PASSWORD unset).
 */
export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Authentication is not enabled' },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = body?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  const expected = process.env.STORINARY_ADMIN_PASSWORD || '';
  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60, // seconds
  });
  return response;
}
