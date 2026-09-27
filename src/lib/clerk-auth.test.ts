import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getClerkAuth, getClerkTenantId, authorizeClerkDashboard } from './clerk-auth';
import { rawPrisma } from './prisma';

const { authenticateRequestMock } = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    authenticateRequest: authenticateRequestMock,
  })),
}));

vi.mock('./prisma', () => ({
  prisma: {},
  rawPrisma: {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    member: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('clerk-auth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.CLERK_SECRET_KEY = 'sk_test_123';
  });

  it('returns null from getClerkAuth when request is signed out', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      isSignedIn: false,
      toAuth: () => ({ userId: null }),
    });

    const result = await getClerkAuth(new Request('http://localhost:3000/api/test'));
    expect(result).toBeNull();
  });

  it('resolves authenticated Clerk user details', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({
        userId: 'user_clerk_123',
        orgId: 'org_clerk_456',
        orgRole: 'org:admin',
        orgSlug: 'acme-corp',
        sessionClaims: {
          email: 'founder@acme.test',
          name: 'Acme Founder',
        },
      }),
    });

    const result = await getClerkAuth(new Request('http://localhost:3000/api/test'));
    expect(result).toEqual({
      userId: 'user_clerk_123',
      orgId: 'org_clerk_456',
      orgRole: 'org:admin',
      orgSlug: 'acme-corp',
      email: 'founder@acme.test',
      name: 'Acme Founder',
    });
  });

  it('synchronizes organization and user in Prisma and returns organization ID in getClerkTenantId', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({
        userId: 'user_clerk_123',
        orgId: 'org_clerk_456',
        orgRole: 'org:admin',
        orgSlug: 'acme-corp',
        sessionClaims: {
          email: 'founder@acme.test',
          name: 'Acme Founder',
        },
      }),
    });

    vi.mocked(rawPrisma.organization.findUnique).mockResolvedValueOnce(null);
    vi.mocked(rawPrisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(rawPrisma.member.findUnique).mockResolvedValueOnce(null);
    vi.mocked(rawPrisma.user.findUnique).mockResolvedValueOnce({ id: 'user_clerk_123' } as never);

    const tenantId = await getClerkTenantId(new Request('http://localhost:3000/api/test'));
    expect(tenantId).toBe('org_clerk_456');

    expect(rawPrisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'org_clerk_456',
          slug: 'acme-corp',
        }),
      })
    );
  });

  it('authorizes dashboard requests for active Clerk sessions', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({
        userId: 'user_clerk_123',
        orgId: 'org_clerk_456',
        orgRole: 'org:admin',
        orgSlug: 'acme-corp',
      }),
    });

    vi.mocked(rawPrisma.organization.findUnique).mockResolvedValueOnce({ id: 'org_clerk_456' } as never);
    vi.mocked(rawPrisma.user.findUnique).mockResolvedValueOnce({ id: 'user_clerk_123' } as never);
    vi.mocked(rawPrisma.member.findUnique).mockResolvedValueOnce({ id: 'org_clerk_456_user_clerk_123' } as never);

    const authResult = await authorizeClerkDashboard(new Request('http://localhost:3000/api/test'));
    expect(authResult).toEqual({
      ok: true,
      keyId: null,
      organizationId: 'org_clerk_456',
    });
  });
});
