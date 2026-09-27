import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { rawPrisma } from '@/lib/prisma';
import { currentTenantScope } from '@/lib/prisma-scope';

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
    if (key && !key.revokedAt) return key.organizationId;
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!organizationId) throw new TenantContextError('Select or create an organization first');
  if (!session.user.emailVerified) {
    throw new TenantContextError('Verify your email before accessing media');
  }
  return organizationId;
}

export async function getTenantIdOrNull(request?: Request): Promise<string | null> {
  try {
    return await getTenantId(request);
  } catch (error) {
    if (error instanceof TenantContextError) return null;
    throw error;
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
  const slug = path.replace(/^\/+/, '').split('/')[0];
  if (!slug) throw new TenantContextError('Tenant path is required');
  const organization = await rawPrisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!organization) throw new TenantContextError('Organization not found');
  return organization.id;
}
