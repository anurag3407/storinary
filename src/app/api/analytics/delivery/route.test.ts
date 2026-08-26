// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  canManageMedia: vi.fn(),
  getDeliveryAnalytics: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ canManageMedia: mocks.canManageMedia }));
vi.mock('@/lib/delivery-analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/delivery-analytics')>()),
  getDeliveryAnalytics: mocks.getDeliveryAnalytics,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/analytics/delivery', () => {
  it('requires dashboard access', async () => {
    mocks.canManageMedia.mockResolvedValue(false);
    const response = await GET(new NextRequest('http://localhost/api/analytics/delivery'));
    expect(response.status).toBe(401);
    expect(mocks.getDeliveryAnalytics).not.toHaveBeenCalled();
  });

  it('validates and bounds the requested range', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    mocks.getDeliveryAnalytics.mockResolvedValue({ range: { days: 7 }, byDay: [] });
    await GET(new NextRequest('http://localhost/api/analytics/delivery?days=999'));
    expect(mocks.getDeliveryAnalytics).toHaveBeenCalledWith(999);
  });

  it('rejects invalid ranges', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    const response = await GET(new NextRequest('http://localhost/api/analytics/delivery?days=bad'));
    expect(response.status).toBe(400);
    expect(mocks.getDeliveryAnalytics).not.toHaveBeenCalled();
  });
});
