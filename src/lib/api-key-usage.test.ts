import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiKeyUsage } from './api-key-usage';

const prisma = vi.hoisted(() => ({
  apiKeyUsageEvent: { groupBy: vi.fn() },
  apiKey: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma }));

beforeEach(() => {
  prisma.apiKey.findMany.mockReset().mockResolvedValue([
    { id: 'key-1', name: 'Site', lastFour: '1234', scopes: 'upload,read' },
  ]);
  prisma.apiKeyUsageEvent.groupBy.mockReset().mockResolvedValue([]);
});

describe('getApiKeyUsage', () => {
  it('summarizes totals and per-action usage', async () => {
    vi.useFakeTimers({ now: new Date('2026-08-25T12:00:00.000Z') });
    prisma.apiKeyUsageEvent.groupBy.mockResolvedValue([
      { apiKeyId: 'key-1', action: 'upload', _sum: { requests: 3, assets: 4, errors: 1, bytes: BigInt(900) } },
      { apiKeyId: 'key-1', action: 'read', _sum: { requests: 7, assets: 70, errors: 0, bytes: 0 } },
      { apiKeyId: 'missing', action: 'unknown', _sum: { requests: 1, assets: 0, errors: 0, bytes: 0 } },
    ]);

    const result = await getApiKeyUsage(7);
    vi.useRealTimers();

    expect(result.range.days).toBe(7);
    expect(result.range.from).toBe('2026-08-19T00:00:00.000Z');
    expect(result.keys).toHaveLength(1);
    expect(result.keys[0].scopes).toEqual(['upload', 'read']);
    expect(result.keys[0].usage.requests).toBe(10);
    expect(result.keys[0].usage.assets).toBe(74);
    expect(result.keys[0].usage.errors).toBe(1);
    expect(result.keys[0].usage.bytes).toBe(900);
    expect(result.keys[0].usage.byAction.upload.assets).toBe(4);
    expect(result.keys[0].usage.byAction.read.requests).toBe(7);
  });
});
