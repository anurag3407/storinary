import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import {
  deleteEmptyFolder,
  listFolders,
  normalizeFolderPath,
  renameFolder,
} from '@/lib/folders';

export const runtime = 'nodejs';

const RESERVED_PATHS = new Set(['/api', '/images', '/videos']);

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ folders: await listFolders() });
  } catch (error) {
    console.error('API /api/folders error:', error);
    return NextResponse.json({ error: 'Unable to load folders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const from = normalizeFolderPath(body?.from);
  const to = normalizeFolderPath(body?.to);
  if (!from || !to) {
    return NextResponse.json({ error: 'Valid folder paths are required' }, { status: 400 });
  }
  if (to === from) {
    return NextResponse.json({ success: true, renamedImages: 0, renamedVideos: 0 });
  }
  if (RESERVED_PATHS.has(to)) {
    return NextResponse.json({ error: 'Destination folder is reserved' }, { status: 400 });
  }

  try {
    const result = await renameFolder(from, to);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/folders rename error:', error);
    return NextResponse.json({ error: 'Unable to rename folder' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = normalizeFolderPath(new URL(request.url).searchParams.get('path'));
  if (!path || path === '/') {
    return NextResponse.json({ error: 'A non-root folder path is required' }, { status: 400 });
  }

  try {
    const result = await deleteEmptyFolder(path);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /api/folders delete error:', error);
    return NextResponse.json({ error: 'Unable to delete folder' }, { status: 500 });
  }
}
