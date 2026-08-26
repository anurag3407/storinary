import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import { auditOrphanedStorage, deleteOrphanedStorage } from '@/lib/storage-audit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const offsetParam = request.nextUrl.searchParams.get('offset');
    const offset = Number.parseInt(offsetParam || '0', 10);
    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });
    }
    return NextResponse.json(await auditOrphanedStorage(offset));
  } catch (error) {
    console.error('API /api/storage/orphans audit error:', error);
    return NextResponse.json({ error: 'Unable to audit storage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const keys = Array.isArray(body?.keys)
    ? body.keys.filter((key: unknown): key is string => typeof key === 'string')
    : [];
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No storage keys selected' }, { status: 400 });
  }

  try {
    return NextResponse.json(await deleteOrphanedStorage(keys));
  } catch (error) {
    console.error('API /api/storage/orphans delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete orphaned files' },
      { status: 400 }
    );
  }
}
