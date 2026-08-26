import { NextRequest, NextResponse } from 'next/server';
import { canManageMedia } from '@/lib/media-auth';
import { getDeliveryAnalytics } from '@/lib/delivery-analytics';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await canManageMedia(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Number.parseInt(request.nextUrl.searchParams.get('days') || '30', 10);
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getDeliveryAnalytics(days));
  } catch (error) {
    console.error('API /api/analytics/delivery error:', error);
    return NextResponse.json({ error: 'Unable to load analytics' }, { status: 500 });
  }
}
