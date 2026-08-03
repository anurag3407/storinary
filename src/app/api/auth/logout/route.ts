import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_COOKIE_OPTS } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/logout — clear the session cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', {
    ...SESSION_COOKIE_OPTS,
    maxAge: 0,
  });
  return response;
}
