import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteFromStorage } from '@/lib/storage';
import { serializeImage } from '@/lib/utils';
import { getImageDetail } from '@/lib/image-detail';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/images/:id — get a single image with generated links.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const data = await getImageDetail(id);
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/images/:id — delete a single image.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Best-effort storage delete — never block DB removal on storage failure
  try {
    await deleteFromStorage(image.storagePath);
  } catch {
    // continue with DB delete
  }

  await prisma.image.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/images/:id — update image metadata (tags, altText, folder).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data: { tags?: string; altText?: string; folder?: string } = {};
  if (typeof body.tags === 'string') data.tags = body.tags;
  if (typeof body.altText === 'string') data.altText = body.altText;
  if (typeof body.folder === 'string') data.folder = body.folder || '/';

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.image.update({ where: { id }, data });

  return NextResponse.json(serializeImage(updated));
}
