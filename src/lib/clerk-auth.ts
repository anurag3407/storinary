import { headers } from 'next/headers';
import { createClerkClient } from '@clerk/backend';
import { rawPrisma } from '@/lib/prisma';
import { enterTenantScope } from '@/lib/prisma-scope';
import { TenantContextError } from '@/lib/tenant';
import { hasClerkKeys } from '@/lib/auth-config';

let clerkBackendClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkBackendClient() {
  if (!clerkBackendClient) {
    const publishableKey =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;
    clerkBackendClient = createClerkClient({
      publishableKey,
      secretKey,
    });
  }
  return clerkBackendClient;
}

export interface ClerkAuthResult {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
  email?: string;
  name?: string;
}

/**
 * Resolves Clerk auth state from a Request or Next.js headers.
 */
export async function getClerkAuth(request?: Request): Promise<ClerkAuthResult | null> {
  if (!hasClerkKeys()) {
    return null;
  }

  try {
    const client = getClerkBackendClient();
    let req = request;

    if (!req) {
      const headerList = await headers();
      const origin =
        headerList.get('x-forwarded-proto') && headerList.get('host')
          ? `${headerList.get('x-forwarded-proto')}://${headerList.get('host')}`
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      req = new Request(origin, {
        headers: headerList,
      });
    }

    const state = await client.authenticateRequest(req);
    if (!state.isSignedIn) {
      return null;
    }

    const authData = state.toAuth();
    if (!authData.userId) {
      return null;
    }

    const claims = (authData.sessionClaims || {}) as Record<string, unknown>;
    const email =
      (claims.email as string) ||
      (claims.email_address as string) ||
      `${authData.userId}@clerk.user`;
    const name =
      (claims.name as string) ||
      (claims.full_name as string) ||
      'Clerk User';

    return {
      userId: authData.userId,
      orgId: authData.orgId ?? null,
      orgRole: authData.orgRole ?? null,
      orgSlug: authData.orgSlug ?? null,
      email,
      name,
    };
  } catch (error) {
    console.error('[clerk-auth] Failed to authenticate request with Clerk:', error);
    return null;
  }
}

const tenantSyncCache = new Map<string, number>();

export function clearClerkTenantSyncCache(): void {
  tenantSyncCache.clear();
}

/**
 * Synchronizes Clerk organization and user into Prisma so Storinary's
 * relational tenancy, foreign keys, and media scoping work out-of-the-box.
 */
export async function ensureClerkTenantInPrisma(data: {
  organizationId: string;
  userId: string;
  orgName: string;
  orgSlug: string;
  email: string;
  name?: string;
  role?: string;
}): Promise<void> {
  const cacheKey = `${data.organizationId}:${data.userId}`;
  const now = Date.now();
  const cachedTime = tenantSyncCache.get(cacheKey);
  if (cachedTime && now - cachedTime < 300_000) {
    return;
  }

  const existingOrg = await rawPrisma.organization.findUnique({
    where: { id: data.organizationId },
    select: { id: true },
  });

  if (!existingOrg) {
    let slug = data.orgSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existingSlug = await rawPrisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existingSlug && existingSlug.id !== data.organizationId) {
      slug = `${slug}-${data.organizationId.slice(-6).toLowerCase()}`;
    }

    await rawPrisma.organization.create({
      data: {
        id: data.organizationId,
        name: data.orgName,
        slug,
        createdAt: new Date(),
      },
    });
  }

  const existingUser = await rawPrisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });

  if (!existingUser) {
    const existingByEmail = await rawPrisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (!existingByEmail) {
      await rawPrisma.user.create({
        data: {
          id: data.userId,
          name: data.name || 'Clerk User',
          email: data.email,
          emailVerified: true,
        },
      });
    }
  }

  const memberId = `${data.organizationId}_${data.userId}`;
  const existingMember = await rawPrisma.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });

  if (!existingMember) {
    const userExists = await rawPrisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });
    if (userExists) {
      await rawPrisma.member.create({
        data: {
          id: memberId,
          organizationId: data.organizationId,
          userId: data.userId,
          role: data.role || 'owner',
          createdAt: new Date(),
        },
      });
    }
  }

  tenantSyncCache.set(cacheKey, now);
}

/**
 * Resolves the active organization tenant ID for Clerk requests.
 */
export async function getClerkTenantId(request?: Request): Promise<string> {
  const auth = await getClerkAuth(request);
  if (!auth || !auth.userId) {
    throw new TenantContextError('Sign in with Clerk or select an organization first');
  }

  const tenantOrgId =
    auth.orgId || `clerk_${auth.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const orgName = auth.orgSlug || (auth.orgId ? 'Clerk Workspace' : 'Personal Workspace');
  const orgSlug = auth.orgSlug || `user-${auth.userId.slice(-8).toLowerCase()}`;

  await ensureClerkTenantInPrisma({
    organizationId: tenantOrgId,
    userId: auth.userId,
    orgName,
    orgSlug,
    email: auth.email || `${auth.userId}@clerk.user`,
    name: auth.name,
    role: auth.orgRole || 'owner',
  });

  return tenantOrgId;
}

/**
 * Authorizes dashboard requests when Clerk is enabled.
 */
export async function authorizeClerkDashboard(request: Request): Promise<
  | { ok: true; keyId: string | null; organizationId: string }
  | { ok: false; status: number; error: string }
> {
  try {
    const tenantId = await getClerkTenantId(request);
    enterTenantScope(tenantId);
    return { ok: true, keyId: null, organizationId: tenantId };
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    return {
      ok: false,
      status: err.status || 401,
      error: err.message || 'Unauthorized',
    };
  }
}
