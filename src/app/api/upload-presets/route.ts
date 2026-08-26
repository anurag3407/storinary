import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import {
  createUploadPreset,
  listUploadPresets,
  parseUploadPreset,
} from '@/lib/upload-presets';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
  return NextResponse.json({ presets: await listUploadPresets(activeOnly) });
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const parsed = parseUploadPreset(body);
    const preset = await createUploadPreset(parsed);
    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create upload preset';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
