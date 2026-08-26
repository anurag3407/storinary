import { authenticateScopedApiKey } from '@/lib/api-keys';
import { canManageMedia } from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';

export type MediaManagementAuthorization =
  | { ok: true; keyId: string | null }
  | { ok: false; status: number; error: string };

export async function authorizeDashboardOrReadApiKey(
  request: Request
): Promise<MediaManagementAuthorization> {
  const hasApiKey = Boolean(
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.match(/^Bearer\s+\S/i)
  );
  if (hasApiKey) return authenticateScopedApiKey(request, undefined, undefined, 'read');
  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function authorizeDashboardOrDeleteApiKey(
  request: Request
): Promise<MediaManagementAuthorization> {
  const hasApiKey = Boolean(
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.match(/^Bearer\s+\S/i)
  );
  if (hasApiKey) return authenticateScopedApiKey(request, undefined, undefined, 'delete');
  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function authorizeDashboardOrWriteApiKey(
  request: Request
): Promise<MediaManagementAuthorization> {
  const hasApiKey = Boolean(
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.match(/^Bearer\s+\S/i)
  );
  if (hasApiKey) return authenticateScopedApiKey(request, undefined, undefined, 'write');
  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function recordManagementApiKeyUsage(
  keyId: string | null,
  action: 'read' | 'write' | 'delete',
  result?: { assets?: number; errors?: number; bytes?: number }
) {
  if (!keyId) return;
  await recordApiKeyUsage(keyId, action, result);
}
