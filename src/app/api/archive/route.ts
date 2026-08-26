import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import { canManageMedia } from '@/lib/media-auth';
import { collectArchiveEntries, createZipArchive, MAX_ARCHIVE_FILES } from '@/lib/archive';

export const runtime = 'nodejs';

const ARCHIVE_CONTENT_TYPE = 'application/zip';

function archiveFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `storinary-${timestamp}.zip`;
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === 'string')
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No image IDs provided' }, { status: 400 });
  }
  if (ids.length > MAX_ARCHIVE_FILES) {
    return NextResponse.json({ error: `Archive limited to ${MAX_ARCHIVE_FILES} images` }, { status: 400 });
  }

  const images = await prisma.image.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      originalName: true,
      storagePath: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (images.length === 0) {
    return NextResponse.json({ error: 'No matching images found' }, { status: 404 });
  }

  try {
    const entries = await collectArchiveEntries(images, getFromStorage);
    const archive = createZipArchive(entries);
    return new Response(new Uint8Array(archive), {
      headers: {
        'Content-Type': ARCHIVE_CONTENT_TYPE,
        'Content-Length': String(archive.byteLength),
        'Content-Disposition': `attachment; filename="${archiveFilename()}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create archive';
    const status = message.includes('limit') || message.includes('between') ? 413 : 502;
    console.error('API /api/archive error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
