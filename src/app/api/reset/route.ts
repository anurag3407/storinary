import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateQuotaCache } from '@/lib/quota';
import { invalidateStatsCache } from '@/lib/stats';

export const runtime = 'nodejs';

/**
 * DELETE /api/reset — delete all database records (keeps storage files intact).
 * Used by the Settings page "Reset Database" danger action.
 */
export async function DELETE() {
  try {
    await prisma.image.deleteMany({});
    invalidateQuotaCache();
    invalidateStatsCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
