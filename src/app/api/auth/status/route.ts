import { NextResponse } from 'next/server';
import { isAuthEnabled } from '@/lib/auth';

/**
 * GET /api/auth/status — whether auth is enabled (UI hints).
 * Does not leak whether the current session is valid.
 */
export async function GET() {
  return NextResponse.json({ enabled: isAuthEnabled() });
}
