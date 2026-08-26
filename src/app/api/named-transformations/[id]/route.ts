import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canManageMedia } from '@/lib/media-auth';
import { parseNamedTransformation, validateNamedTransformationParams } from '@/lib/named-transformations';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  try {
    const data =
      typeof body.active === 'boolean' && Object.keys(body).length === 1
        ? { active: body.active }
        : (() => {
            const parsed = parseNamedTransformation(body);
            if (!validateNamedTransformationParams(parsed.params)) {
              throw new Error('Transform parameters did not produce a valid transformation');
            }
            return parsed;
          })();
    const transformation = await prisma.namedTransformation.update({ where: { id }, data });
    return NextResponse.json({ transformation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update named transformation';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    await prisma.namedTransformation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Named transformation not found' }, { status: 404 });
  }
}
