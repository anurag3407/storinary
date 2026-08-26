import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { ApiKeyRecord } from '@/types';

const KEY_PREFIX = 'stor_live_';
const KEY_BYTES = 32;
const SIGNATURE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type ApiKeyScope = 'upload' | 'read' | 'video-upload' | 'write' | 'delete';
export type ApiKeyUsageAction = 'upload' | 'video-upload' | 'read' | 'write' | 'delete';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function serializeApiKey(key: {
  id: string;
  name: string;
  keyPrefix: string;
  lastFour: string;
  scopes: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyRecord {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    lastFour: key.lastFour,
    scopes: key.scopes.split(',').filter(Boolean),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

export async function createApiKey(
  name: string,
  scopes = 'upload,read'
) {
  const cleanName = name.trim().slice(0, 80) || 'Default key';
  const secret = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
  const key = await prisma.apiKey.create({
    data: {
      name: cleanName,
      hashedKey: hashSecret(secret),
      keyPrefix: KEY_PREFIX,
      lastFour: secret.slice(-4),
      scopes,
    },
  });

  return { ...serializeApiKey(key), secret };
}

export async function listApiKeys() {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    where: { revokedAt: null },
  });
  return keys.map(serializeApiKey);
}

export async function revokeApiKey(id: string) {
  const key = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return serializeApiKey(key);
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createRequestSignature(
  secret: string,
  parameters: Record<string, string>,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const canonical = Object.keys(parameters)
    .filter((name) => name !== 'file' && name !== 'api_signature')
    .sort()
    .map((name) => `${name}=${parameters[name]}`)
    .join('&');
  return createHmac('sha256', secret).update(`${canonical}${timestamp}`).digest('hex');
}

async function verifySignature(
  secret: string,
  formData: FormData
): Promise<boolean> {
  const provided = formData.get('api_signature');
  const timestampValue = formData.get('timestamp');
  if (typeof provided !== 'string' || typeof timestampValue !== 'string') return false;

  const timestamp = Number.parseInt(timestampValue, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() - timestamp * 1000) > SIGNATURE_MAX_AGE_MS) return false;

  const parameters: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (
      typeof value === 'string' &&
      !['api_key', 'timestamp', 'api_signature'].includes(name)
    ) {
      parameters[name] = value;
    }
  }
  const expected = createRequestSignature(secret, parameters, timestamp);
  return constantTimeEquals(expected, provided);
}

export async function authenticateScopedApiKey(
  request: Request,
  formData?: FormData,
  preset?: { unsigned: boolean } | null,
  requiredScope: ApiKeyScope = 'upload'
): Promise<
  | { ok: true; keyId: string }
  | { ok: false; status: number; error: string }
> {
  const header =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  const secret = header || (formData?.get('api_key') ?? '');
  if (typeof secret !== 'string' || !secret.startsWith(KEY_PREFIX)) {
    return { ok: false, status: 401, error: 'Missing or invalid API key' };
  }

  const expectedHash = hashSecret(secret);
  const key = await prisma.apiKey.findUnique({ where: { hashedKey: expectedHash } });
  if (!key || key.revokedAt || !constantTimeEquals(key.hashedKey, expectedHash)) {
    return { ok: false, status: 401, error: 'Invalid or revoked API key' };
  }

  if (!key.scopes.split(',').includes(requiredScope)) {
    return { ok: false, status: 403, error: `API key lacks ${requiredScope} scope` };
  }

  const signed = Boolean(formData?.has('api_signature'));
  if (preset?.unsigned && signed) {
    return { ok: false, status: 400, error: 'Unsigned preset cannot include api_signature' };
  }

  if (signed) {
    const valid = await verifySignature(secret, formData!);
    if (!valid) return { ok: false, status: 401, error: 'Invalid upload signature' };
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return { ok: true, keyId: key.id };
}

export async function authenticateApiKey(
  request: Request,
  formData?: FormData,
  preset?: { unsigned: boolean } | null
) {
  return authenticateScopedApiKey(request, formData, preset, 'upload');
}

export async function authenticateReadApiKey(request: Request) {
  return authenticateScopedApiKey(request, undefined, undefined, 'read');
}

export async function authenticateVideoApiKey(
  request: Request,
  formData?: FormData,
  preset?: { unsigned: boolean } | null
): Promise<
  | { ok: true; keyId: string }
  | { ok: false; status: number; error: string }
> {
  return authenticateScopedApiKey(request, formData, preset, 'video-upload');
}

export async function recordApiKeyUsage(
  apiKeyId: string,
  action: ApiKeyUsageAction,
  result: { assets?: number; errors?: number; bytes?: number } = {}
): Promise<void> {
  const periodStart = new Date();
  periodStart.setUTCHours(0, 0, 0, 0);

  try {
    await prisma.apiKeyUsageEvent.upsert({
      where: {
        apiKeyId_periodStart_action: {
          apiKeyId,
          periodStart,
          action,
        },
      },
      create: {
        apiKeyId,
        periodStart,
        action,
        requests: 1,
        assets: Math.max(0, Math.floor(result.assets ?? 0)),
        errors: Math.max(0, Math.floor(result.errors ?? 0)),
        bytes: BigInt(Math.max(0, Math.floor(result.bytes ?? 0))),
      },
      update: {
        requests: { increment: 1 },
        assets: { increment: Math.max(0, Math.floor(result.assets ?? 0)) },
        errors: { increment: Math.max(0, Math.floor(result.errors ?? 0)) },
        bytes: { increment: BigInt(Math.max(0, Math.floor(result.bytes ?? 0))) },
      },
    });
  } catch (error) {
    console.error('API key usage recording error:', error);
  }
}
