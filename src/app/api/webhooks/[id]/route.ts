import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canManageMedia } from '@/lib/media-auth';
import { serializeWebhookEndpoint, validateWebhookUrl } from '@/lib/webhooks';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function rotateSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const data: { active?: boolean; name?: string; url?: string; secret?: string } = {};
  if (typeof body?.active === 'boolean') data.active = body.active;
  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (body?.url !== undefined) {
    const url = validateWebhookUrl(body.url);
    if (!url) return NextResponse.json({ error: 'A public HTTPS URL is required' }, { status: 400 });
    data.url = url;
  }
  if (body?.rotateSecret === true) data.secret = rotateSecret();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const endpoint = await prisma.webhookEndpoint.update({ where: { id }, data });
    return NextResponse.json({
      webhook: serializeWebhookEndpoint(endpoint),
      ...(data.secret ? { secret: data.secret } : {}),
    });
  } catch {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await prisma.webhookEndpoint.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }
}
