import { NextResponse } from 'next/server';
import { getStats } from '@/lib/stats';

export const runtime = 'nodejs';

/**
 * GET /api/stats — dashboard statistics endpoint.
 */
export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
