import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * DELETE /api/reset — delete all database records (keeps storage files intact).
 * Used by the Settings page "Reset Database" danger action.
 */
export async function DELETE() {
  try {
    await prisma.image.deleteMany({});
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
