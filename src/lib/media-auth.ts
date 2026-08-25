import { isAuthEnabled, verifySessionToken } from '@/lib/auth';
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
