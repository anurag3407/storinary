import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock('@/lib/prisma', () => ({ rawPrisma: {}, prisma: {} }));

vi.mock('@/lib/prisma-scope', () => ({
  currentTenantScope: () => null,
  enterTenantScope: vi.fn(),
}));

vi.mock('@/lib/clerk-auth', () => ({
  getClerkAuth: vi.fn(),
  getClerkTenantId: vi.fn(),
}));

vi.mock('@/lib/auth-config', () => ({
  isClerkEnabled: () => false,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { hasAuthenticatedUser } from './tenant';

describe('hasAuthenticatedUser', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('reports a signed-in user when a session exists', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1' }, session: {} });
    await expect(hasAuthenticatedUser()).resolves.toBe(true);
  });

  it('reports signed-out when no session exists', async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(hasAuthenticatedUser()).resolves.toBe(false);
  });

  it('fails closed when session lookup throws', async () => {
    getSessionMock.mockRejectedValue(new Error('database unavailable'));
    await expect(hasAuthenticatedUser()).resolves.toBe(false);
  });
});
