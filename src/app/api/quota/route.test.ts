import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { authorizeDashboardOrReadApiKeyMock, getAccountStorageUsageMock } =
  vi.hoisted(() => ({
    authorizeDashboardOrReadApiKeyMock: vi.fn(),
    getAccountStorageUsageMock: vi.fn(),
  }));

vi.mock('@/lib/media-auth', () => ({
  authorizeDashboardOrReadApiKey: authorizeDashboardOrReadApiKeyMock,
}));

vi.mock('@/lib/quota', () => ({
  ACCOUNT_STORAGE_LIMIT_BYTES: 104857600,
  getAccountStorageUsage: getAccountStorageUsageMock,
}));

describe('GET /api/quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    authorizeDashboardOrReadApiKeyMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    });

    const request = new NextRequest('http://localhost:3000/api/quota');
    const response = await GET(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns account quota and plan information when authorized', async () => {
    authorizeDashboardOrReadApiKeyMock.mockResolvedValueOnce({
      ok: true,
      keyId: null,
      organizationId: 'org_test_123',
    });

    getAccountStorageUsageMock.mockResolvedValueOnce({
      organizationId: 'org_test_123',
      planName: 'Free Developer Tier',
      limitBytes: 104857600,
      limitFormatted: '100 MB',
      usedBytes: 15 * 1024 * 1024,
      usedFormatted: '15 MB',
      remainingBytes: 85 * 1024 * 1024,
      remainingFormatted: '85 MB',
      percentage: 15,
      isExceeded: false,
      isNearLimit: false,
    });

    const request = new NextRequest('http://localhost:3000/api/quota');
    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.quota.limitFormatted).toBe('100 MB');
    expect(json.quota.percentage).toBe(15);
    expect(json.plans).toHaveLength(3);
    expect(json.plans[0].name).toBe('Free Developer Tier');
    expect(json.plans[0].current).toBe(true);
  });
});
