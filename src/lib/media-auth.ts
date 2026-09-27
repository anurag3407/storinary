import { auth } from '@/lib/auth';
import { authenticateScopedApiKey, type ApiKeyScope } from '@/lib/api-keys';
import { enterTenantScope } from '@/lib/prisma-scope';

export type Authorization =
  | { ok: true; keyId: string | null; organizationId: string }
  | { ok: false; status: number; error: string };

function hasApiKey(request: Request): boolean {
  return Boolean(
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.match(/^Bearer\s+\S/i)
  );
}

/**
 * Authorize a dashboard session for the active organization.
 *
 * Requires a live session, a verified email, and an active organization. On
 * success the organization is bound to the async scope so every subsequent
 * Prisma call in this request is tenant-filtered.
 */
async function authorizeDashboard(request: Request): Promise<Authorization> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!session.user.emailVerified) {
    return { ok: false, status: 403, error: 'Verify your email first' };
  }
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return { ok: false, status: 403, error: 'Select or create an organization first' };
  }
  enterTenantScope(organizationId);
  return { ok: true, keyId: null, organizationId };
}

/**
 * Authorize a request using either a scoped API key or a dashboard session.
 * API-key requests resolve their organization from the key record itself.
 */
export async function authorizeDashboardOrScopedApiKey(
  request: Request,
  formData?: FormData,
  requiredScope: ApiKeyScope = 'upload',
  preset?: { unsigned: boolean } | null
): Promise<Authorization> {
  if (hasApiKey(request) || typeof formData?.get('api_key') === 'string') {
    const result = await authenticateScopedApiKey(request, formData, preset, requiredScope);
    if (!result.ok) return result;
    enterTenantScope(result.organizationId);
    return { ok: true, keyId: result.keyId, organizationId: result.organizationId };
  }
  return authorizeDashboard(request);
}

export const authorizeDashboardOrApiKey = (
  request: Request,
  formData?: FormData,
  requiredScope: ApiKeyScope = 'upload',
  preset?: { unsigned: boolean } | null
) => authorizeDashboardOrScopedApiKey(request, formData, requiredScope, preset);

export const authorizeDashboardOrReadApiKey = (request: Request) =>
  authorizeDashboardOrScopedApiKey(request, undefined, 'read');

export const authorizeDashboardOrScopedUploadApiKey = (
  request: Request,
  formData?: FormData,
  requiredScope: 'upload' | 'video-upload' = 'upload',
  preset?: { unsigned: boolean } | null
) => authorizeDashboardOrScopedApiKey(request, formData, requiredScope, preset);

/** True when the caller may manage media in their active organization. */
export async function canManageMedia(request: Request): Promise<boolean> {
  return (await authorizeDashboard(request)).ok;
}
