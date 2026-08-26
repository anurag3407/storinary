import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  authorizeDashboardOrReadApiKey,
  authorizeDashboardOrWriteApiKey,
  recordManagementApiKeyUsage,
} from '@/lib/media-management-auth';
import { parseMetadataField, serializeMetadataField } from '@/lib/structured-metadata';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authorization = await authorizeDashboardOrReadApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const fields = await prisma.metadataField.findMany({ orderBy: { externalId: 'asc' } });
  return NextResponse.json({ fields: fields.map(serializeMetadataField) });
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  try {
    const data = parseMetadataField(await request.json());
    const field = await prisma.metadataField.create({ data });
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { assets: 1 });
    return NextResponse.json({ field: serializeMetadataField(field) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
      return NextResponse.json({ error: 'A metadata field with this external ID already exists' }, { status: 409 });
    }
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to create metadata field',
    }, { status: 400 });
  }
}
