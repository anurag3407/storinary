import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import { addToCollection, deleteCollection, removeFromCollection, updateCollection } from '@/lib/collections';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function parseAssetIds(body: unknown) {
  const source = (body ?? {}) as Record<string, unknown>;
  const imageIds = Array.isArray(source.imageIds)
    ? source.imageIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const videoIds = Array.isArray(source.videoIds)
    ? source.videoIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  return { imageIds, videoIds };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const action = body.action;
  if (action === 'add' || action === 'remove') {
    const { imageIds, videoIds } = parseAssetIds(body);
    const result = action === 'add'
      ? await addToCollection(id, imageIds, videoIds)
      : await removeFromCollection(id, imageIds, videoIds);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data);
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
  const description = typeof body?.description === 'string' ? body.description.trim() : undefined;
  const result = await updateCollection(id, { name, description });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await deleteCollection(id);
  if (!deleted) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
