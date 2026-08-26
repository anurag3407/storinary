import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canManageMedia } from '@/lib/media-auth';
import { parseNamedTransformation, validateNamedTransformationParams } from '@/lib/named-transformations';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const transformations = await prisma.namedTransformation.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({
    transformations: transformations.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const input = parseNamedTransformation(body);
    if (!validateNamedTransformationParams(input.params)) {
      return NextResponse.json({ error: 'Transform parameters did not produce a valid transformation' }, { status: 400 });
    }
    const transformation = await prisma.namedTransformation.create({ data: input });
    return NextResponse.json({ transformation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create named transformation';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
