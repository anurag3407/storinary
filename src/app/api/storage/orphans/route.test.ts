// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  canManageMedia: vi.fn(),
  auditOrphanedStorage: vi.fn(),
  deleteOrphanedStorage: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ canManageMedia: mocks.canManageMedia }));
vi.mock('@/lib/storage-audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage-audit')>()),
  auditOrphanedStorage: mocks.auditOrphanedStorage,
  deleteOrphanedStorage: mocks.deleteOrphanedStorage,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/storage/orphans', () => {
  it('protects audit and cleanup operations', async () => {
    mocks.canManageMedia.mockResolvedValue(false);
    expect((await GET(new NextRequest('http://localhost/api/storage/orphans'))).status).toBe(401);
    expect(
      (
        await POST(new NextRequest('http://localhost/api/storage/orphans', {
          method: 'POST',
          body: JSON.stringify({ keys: ['x'] }),
          headers: { 'content-type': 'application/json' },
        }))
      ).status
    ).toBe(401);
    expect(mocks.auditOrphanedStorage).not.toHaveBeenCalled();
    expect(mocks.deleteOrphanedStorage).not.toHaveBeenCalled();
  });

  it('audits with a validated offset', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    mocks.auditOrphanedStorage.mockResolvedValue({ scanned: 0, orphans: [] });

    const response = await GET(new NextRequest('http://localhost/api/storage/orphans?offset=100'));
    expect(response.status).toBe(200);
    expect(mocks.auditOrphanedStorage).toHaveBeenCalledWith(100);
  });

  it('requires explicit keys for cleanup', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    const response = await POST(new NextRequest('http://localhost/api/storage/orphans', {
      method: 'POST',
      body: JSON.stringify({ keys: [] }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    expect(mocks.deleteOrphanedStorage).not.toHaveBeenCalled();
  });
});
