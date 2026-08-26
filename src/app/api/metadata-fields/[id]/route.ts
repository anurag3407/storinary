import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeDashboardOrWriteApiKey } from '@/lib/media-management-auth';
import { parseMetadataField, serializeMetadataField } from '@/lib/structured-metadata';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    if (
      typeof body.active === 'boolean' &&
      Object.keys(body).length === 1
    ) {
      const field = await prisma.metadataField.update({ where: { id }, data: body });
      return NextResponse.json({ field: serializeMetadataField(field) });
    }

    const data = parseMetadataField(body);
    const field = await prisma.metadataField.update({
      where: { id },
      data: {
        ...data,
        externalId: undefined,
      },
    });
    return NextResponse.json({ field: serializeMetadataField(field) });
  } catch {
    return NextResponse.json({ error: 'Unable to update metadata field' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const { id } = await context.params;
  try {
    await prisma.metadataField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Metadata field not found' }, { status: 404 });
  }
}
