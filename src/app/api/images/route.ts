import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bulkDeleteFromStorage } from '@/lib/storage';
import { serializeImage } from '@/lib/utils';
import type { BulkDeleteResponse, ImagesListResponse } from '@/types';

export const runtime = 'nodejs';

const SORT_FIELDS = ['createdAt', 'fileSize', 'originalName'] as const;
type SortField = (typeof SORT_FIELDS)[number];

/**
 * GET /api/images — list images with pagination, search, and filters.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20)
  );
  const search = searchParams.get('search') || undefined;
  const folder = searchParams.get('folder') || undefined;
  const sortRaw = searchParams.get('sort') || 'createdAt';
  const orderRaw = searchParams.get('order') || 'desc';

  const sort: SortField = SORT_FIELDS.includes(sortRaw as SortField)
    ? (sortRaw as SortField)
    : 'createdAt';
  const order: 'asc' | 'desc' = orderRaw === 'asc' ? 'asc' : 'desc';

  const where: Prisma.ImageWhereInput = {};
  if (search) {
    where.OR = [
      { originalName: { contains: search } },
      { tags: { contains: search } },
      { altText: { contains: search } },
    ];
  }
  if (folder) {
    where.folder = folder;
  }

  try {
    const [items, total] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy: { [sort]: order } as Prisma.ImageOrderByWithRelationInput,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.image.count({ where }),
    ]);

    return NextResponse.json({
      images: items.map(serializeImage),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    } satisfies ImagesListResponse);
  } catch (error) {
    console.error('API /api/images error:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

/**
 * DELETE /api/images — bulk delete images (max 100 per request).
 */
export async function DELETE(request: NextRequest) {
  let ids: string[] = [];
  try {
    const body = await request.json();
    ids = Array.isArray(body?.ids) ? body.ids.filter((i: unknown) => typeof i === 'string') : [];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'No image IDs provided' },
      { status: 400 }
    );
  }
  if (ids.length > 100) {
    return NextResponse.json(
      { error: 'Cannot delete more than 100 images at once' },
      { status: 400 }
    );
  }

  const images = await prisma.image.findMany({
    where: { id: { in: ids } },
    select: { id: true, storagePath: true },
  });

  let storageError: string | null = null;
  try {
    await bulkDeleteFromStorage(images.map((i) => i.storagePath));
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Storage delete failed';
  }

  const result = await prisma.image.deleteMany({
    where: { id: { in: ids } },
  });

  const response: BulkDeleteResponse = {
    success: !storageError,
    deleted: result.count,
    errors: storageError
      ? ids.map((id) => ({ id, error: storageError }))
      : [],
  };

  return NextResponse.json(response);
}
