import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageMedia } from '@/lib/media-auth';
import { authorizeDashboardOrReadApiKey } from '@/lib/media-management-auth';

export const runtime = 'nodejs';

const COLLECTION_INCLUDE = {
  items: {
    include: {
      image: {
        select: {
          id: true,
          originalName: true,
          publicUrl: true,
          storagePath: true,
          folder: true,
          createdAt: true,
        },
      },
      video: {
        select: {
          id: true,
          originalName: true,
          posterPath: true,
          duration: true,
          folder: true,
          createdAt: true,
        },
      },
    },
    orderBy: { id: 'desc' },
  },
} satisfies Prisma.CollectionInclude;

export async function GET(request: NextRequest) {
  const authorization = await authorizeDashboardOrReadApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  try {
    const collections = await prisma.collection.findMany({
      include: COLLECTION_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('API /api/collections error:', error);
    return NextResponse.json({ error: 'Unable to load collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
  }

  try {
    const collection = await prisma.collection.create({
      data: {
        name,
        description: typeof body?.description === 'string' ? body.description.trim().slice(0, 300) : '',
      },
      include: COLLECTION_INCLUDE,
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Collection already exists' }, { status: 409 });
    }
    console.error('API /api/collections create error:', error);
    return NextResponse.json({ error: 'Unable to create collection' }, { status: 500 });
  }
}
