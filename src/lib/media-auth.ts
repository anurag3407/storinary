import { isAuthEnabled, verifySessionToken } from '@/lib/auth';
import {
  authenticateApiKey,
  authenticateReadApiKey,
  authenticateVideoApiKey,
} from '@/lib/api-keys';
import { SESSION_COOKIE } from '@/lib/auth';

export async function hasDashboardSession(request: Request): Promise<boolean> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return Boolean(token && (await verifySessionToken(token)));
}

export async function canManageMedia(request: Request): Promise<boolean> {
  return !isAuthEnabled() || (await hasDashboardSession(request));
}

export async function authorizeDashboardOrApiKey(
  request: Request,
  formData?: FormData,
  requiredScope = 'upload',
  preset?: { unsigned: boolean } | null
): Promise<{ ok: true; keyId: string | null } | { ok: false; status: number; error: string }> {
  const header =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  const formKey = formData?.get('api_key');
  if (Boolean(header) || typeof formKey === 'string') {
    return requiredScope === 'video-upload'
      ? authenticateVideoApiKey(request, formData, preset)
      : authenticateApiKey(request, formData, preset);
  }

  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function authorizeDashboardOrReadApiKey(
  request: Request
): Promise<{ ok: true; keyId: string | null } | { ok: false; status: number; error: string }> {
  const hasApiKey =
    Boolean(request.headers.get('x-api-key')) ||
    Boolean(request.headers.get('authorization')?.match(/^Bearer\s+\S/i));
  if (hasApiKey) return authenticateReadApiKey(request);
  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}

export async function authorizeDashboardOrScopedUploadApiKey(
  request: Request,
  formData?: FormData,
  requiredScope: 'upload' | 'video-upload' = 'upload',
  preset?: { unsigned: boolean } | null
): Promise<{ ok: true; keyId: string | null } | { ok: false; status: number; error: string }> {
  const header =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (Boolean(header) || typeof formData?.get('api_key') === 'string') {
    return requiredScope === 'video-upload'
      ? authenticateVideoApiKey(request, formData, preset)
      : authenticateApiKey(request, formData, preset);
  }

  if (await canManageMedia(request)) return { ok: true, keyId: null };
  return { ok: false, status: 401, error: 'Unauthorized' };
}
