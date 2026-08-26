import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from '@/lib/api-keys';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ keys: await listApiKeys() });
  } catch (error) {
    console.error('API /api/api-keys error:', error);
    return NextResponse.json({ error: 'Unable to load API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let name = 'Default key';
  let scopes = 'upload,read';
  try {
    const body = await request.json();
    if (typeof body?.name === 'string' && body.name.trim()) name = body.name;
    if (Array.isArray(body?.scopes)) {
      const allowed = ['upload', 'read', 'video-upload', 'write', 'delete'];
      scopes = [...new Set(body.scopes)].filter((scope: unknown) =>
        typeof scope === 'string' && allowed.includes(scope)
      ).join(',');
      if (!scopes) scopes = 'upload,read';
    }
  } catch {
    // A missing JSON body is valid and uses the default name.
  }

  try {
    return NextResponse.json({ key: await createApiKey(name, scopes) }, { status: 201 });
  } catch (error) {
    console.error('API /api/api-keys create error:', error);
    return NextResponse.json({ error: 'Unable to create API key' }, { status: 500 });
  }
}
