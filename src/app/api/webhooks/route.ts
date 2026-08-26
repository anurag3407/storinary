import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canManageMedia } from '@/lib/media-auth';
import { serializeWebhookEndpoint, validateWebhookUrl } from '@/lib/webhooks';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const endpoints = await prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ webhooks: endpoints.map(serializeWebhookEndpoint) });
  } catch (error) {
    console.error('API /api/webhooks error:', error);
    return NextResponse.json({ error: 'Unable to load webhooks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const url = validateWebhookUrl(body?.url);

  if (!name || !url) {
    return NextResponse.json(
      { error: 'Name and a public HTTPS URL are required' },
      { status: 400 }
    );
  }

  try {
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        name,
        url,
        secret: `whsec_${randomBytes(32).toString('base64url')}`,
        active: true,
      },
    });
    return NextResponse.json(
      { webhook: { ...serializeWebhookEndpoint(endpoint), secret: endpoint.secret } },
      { status: 201 }
    );
  } catch (error) {
    console.error('API /api/webhooks create error:', error);
    return NextResponse.json({ error: 'Unable to create webhook' }, { status: 500 });
  }
}
