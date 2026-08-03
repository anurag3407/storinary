/**
 * Session-based admin authentication.
 *
 * When `STORINARY_ADMIN_PASSWORD` is set, the app requires a signed,
 * expiring session cookie to mutate data (upload / delete / reset) and to
 * view the app pages. When it is unset, the app runs in open "dev mode" —
 * exactly the behavior it had before auth existed.
 *
 * Tokens are HMAC-SHA256 signed with the admin password using the Web Crypto
 * API, so this module works both in Edge middleware and Node route handlers.
 */

export const SESSION_COOKIE = 'storinary_session';
export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** True when the admin password is configured (auth enforced). */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.STORINARY_ADMIN_PASSWORD);
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.STORINARY_ADMIN_PASSWORD || '';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Create a signed session token valid for 7 days. */
export async function createSessionToken(now = Date.now()): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ exp: now + SESSION_TTL_MS }))
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await getHmacKey(),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${toBase64Url(signature)}`;
}

/** Verify a session token: valid signature and not expired. */
export async function verifySessionToken(
  token: string | undefined | null,
  now = Date.now()
): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getHmacKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return false;
    const { exp } = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload))
    ) as { exp?: unknown };
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

/**
 * Length-aware, otherwise constant-time comparison for the login password
 * check. The early return on length mismatch reveals only the length, which
 * is acceptable for an admin password behind a rate limiter.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
