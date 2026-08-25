import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/api-keys';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    return NextResponse.json({ key: await revokeApiKey(id) });
  } catch {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }
}
