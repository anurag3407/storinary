import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import { listWebhookDeliveries } from '@/lib/webhooks';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const endpointId = request.nextUrl.searchParams.get('endpointId') || undefined;
  const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '25', 10) || 25;

  try {
    return NextResponse.json({ deliveries: await listWebhookDeliveries(endpointId, limit) });
  } catch (error) {
    console.error('API /api/webhooks/deliveries error:', error);
    return NextResponse.json({ error: 'Unable to load deliveries' }, { status: 500 });
  }
}
