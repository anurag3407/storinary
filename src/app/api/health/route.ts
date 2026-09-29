import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public liveness probe. Deliberately touches no database, storage, or auth so
 * it keeps returning 200 during an unrelated outage — perfect for uptime
 * monitors and post-deploy smoke tests.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'storinary',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
