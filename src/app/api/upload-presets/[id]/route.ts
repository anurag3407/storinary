import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import { deleteUploadPreset, parseUploadPreset, updateUploadPreset } from '@/lib/upload-presets';

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
    const input =
      typeof body.active === 'boolean' && Object.keys(body).length === 1
        ? { active: body.active }
        : parseUploadPreset(body);
    const preset = await updateUploadPreset(id, input);
    if (!preset) return NextResponse.json({ error: 'Upload preset not found' }, { status: 404 });
    return NextResponse.json({ preset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update upload preset';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!(await deleteUploadPreset(id))) {
    return NextResponse.json({ error: 'Upload preset not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
