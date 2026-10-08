import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { rawPrisma } from '@/lib/prisma';
import { currentTenantScope, enterTenantScope } from '@/lib/prisma-scope';
import { isClerkEnabled } from '@/lib/auth-config';
import { getClerkAuth, getClerkTenantId } from '@/lib/clerk-auth';

/**
 * Raised when a request has no active organization. Routes translate this into
 * a 403 so a verified user is never silently served another tenant's data.
 */
export class TenantContextError extends Error {
  status: number;
  constructor(message = 'An active organization is required') {
    super(message);
    this.name = 'TenantContextError';
    this.status = 403;
  }
}

/**
 * Resolve the active organization for a request.
 *
 * Precedence: an explicit scope established by the caller (public CDN delivery
 * or webhook fan-out) → the verified session's `activeOrganizationId` → the
 * organization that owns a presented API key. The organization is never taken
 * from a request body, query string, or unverified input.
 */
export async function getTenantId(request?: Request): Promise<string> {
  const explicitTenant = currentTenantScope();
  if (explicitTenant) return explicitTenant;

  const requestHeaders = request?.headers ?? (await headers());

  const apiKeyHeader =
    requestHeaders.get('x-api-key') ||
    requestHeaders.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (apiKeyHeader.startsWith('stor_live_')) {
    const key = await rawPrisma.apiKey.findUnique({
      where: { hashedKey: createHash('sha256').update(apiKeyHeader).digest('hex') },
      select: { organizationId: true, revokedAt: true },
    });
    if (key && !key.revokedAt) {
      try { enterTenantScope(key.organizationId); } catch {}
      return key.organizationId;
    }
  }

  if (isClerkEnabled()) {
    const clerkTenantId = await getClerkTenantId(request);
    try { enterTenantScope(clerkTenantId); } catch {}
    return clerkTenantId;
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!organizationId) throw new TenantContextError('Select or create an organization first');
  if (!session.user.emailVerified) {
    throw new TenantContextError('Verify your email before accessing media');
  }
  try { enterTenantScope(organizationId); } catch {}
  return organizationId;
}

export async function getTenantIdOrNull(request?: Request): Promise<string | null> {
  try {
    return await getTenantId(request);
  } catch {
    return null;
  }
}

/**
 * Whether the request carries a verified user session, independent of whether
 * an organization is active. Lets callers distinguish "signed out" from
 * "signed in but has no workspace yet" — the latter should be routed to
 * onboarding rather than shown the marketing page.
 */
export async function hasAuthenticatedUser(request?: Request): Promise<boolean> {
  if (isClerkEnabled()) {
    const clerkAuth = await getClerkAuth(request);
    return Boolean(clerkAuth?.userId);
  }
  try {
    const requestHeaders = request?.headers ?? (await headers());
    const session = await auth.api.getSession({ headers: requestHeaders });
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

/**
 * Prefix an object key with the organization slug so tenants cannot collide in
 * a shared bucket. Public delivery resolves the tenant back from this prefix.
 */
export async function tenantStoragePath(organizationId: string, path: string): Promise<string> {
  const organization = await rawPrisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  if (!organization) throw new TenantContextError('Organization not found');
  return `${organization.slug}/${path.replace(/^\/+/, '')}`;
}

/** Resolve the tenant for a public delivery path from its immutable prefix. */
export async function resolveTenantFromPath(path: string): Promise<string> {
  const clean = path.replace(/^\/+/, '');
  const segments = clean.split('/');

  // If path is multi-segment, the first segment MUST be the organization slug
  if (segments.length > 1) {
    const slug = segments[0];
    const organization = await rawPrisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!organization) throw new TenantContextError('Organization not found');
    return organization.id;
  }

  // Single segment path (legacy un-prefixed asset or bare slug)
  const slug = segments[0];
  if (slug) {
    const organization = await rawPrisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (organization) return organization.id;
  }

  // Check if this key exists under a legacy/existing asset
  const legacyImage = await rawPrisma.image.findFirst({
    where: { storagePath: clean },
    select: { organizationId: true },
  });
  if (legacyImage?.organizationId) return legacyImage.organizationId;

  // Fallback to legacy organization if it exists
  const legacyOrg = await rawPrisma.organization.findUnique({
    where: { id: 'legacy' },
    select: { id: true },
  });
  if (legacyOrg) return legacyOrg.id;

  throw new TenantContextError('Organization not found');
}
