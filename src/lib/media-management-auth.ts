import { recordApiKeyUsage } from '@/lib/api-keys';
import { authorizeDashboardOrScopedApiKey, type Authorization } from '@/lib/media-auth';

export type MediaManagementAuthorization = Authorization;

export const authorizeDashboardOrReadApiKey = (request: Request) =>
  authorizeDashboardOrScopedApiKey(request, undefined, 'read');

export const authorizeDashboardOrDeleteApiKey = (request: Request) =>
  authorizeDashboardOrScopedApiKey(request, undefined, 'delete');

export const authorizeDashboardOrWriteApiKey = (request: Request) =>
  authorizeDashboardOrScopedApiKey(request, undefined, 'write');

export async function recordManagementApiKeyUsage(
  keyId: string | null,
  action: 'read' | 'write' | 'delete',
  result?: { assets?: number; errors?: number; bytes?: number }
) {
  if (!keyId) return;
  await recordApiKeyUsage(keyId, action, result);
}
