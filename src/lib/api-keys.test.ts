// @vitest-environment node
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateApiKey,
  authenticateReadApiKey,
  createRequestSignature,
  createApiKey,
  recordApiKeyUsage,
} from './api-keys';

const { createMock, findUniqueMock, updateMock, upsertMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKey: {
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
    apiKeyUsageEvent: {
      upsert: upsertMock,
    },
  },
}));

function makeRequest(secret?: string) {
  return new Request('https://example.com/api/v1/upload', {
    headers: secret ? { 'x-api-key': secret } : {},
  });
}

describe('API key credentials', () => {
  const expectedHash = createHash('sha256').update('stor_live_test').digest('hex');

  beforeEach(() => {
    createMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    upsertMock.mockReset();
  });

  it('rejects upload-only keys when authenticating reads', async () => {
    updateMock.mockResolvedValue({});
    findUniqueMock.mockResolvedValue({
      id: 'upload-key',
      hashedKey: expectedHash,
      revokedAt: null,
      scopes: 'upload',
    });

    await expect(authenticateReadApiKey(makeRequest('stor_live_test'))).resolves.toMatchObject({
      ok: false,
      status: 403,
      error: 'API key lacks read scope',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('records bounded aggregate usage and swallows recorder failures', async () => {
    upsertMock.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce({});

    await expect(recordApiKeyUsage('key-id', 'upload', {
      assets: 2.2,
      errors: -1,
      bytes: Number.MAX_SAFE_INTEGER,
    })).resolves.toBeUndefined();
    await expect(recordApiKeyUsage('key-id', 'read', { assets: 3 })).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        apiKeyId_periodStart_action: expect.objectContaining({ action: 'read' }),
      }),
      create: expect.objectContaining({ requests: 1, assets: 3, errors: 0, bytes: BigInt(0) }),
      update: expect.objectContaining({
        requests: { increment: 1 },
        assets: { increment: 3 },
        errors: { increment: 0 },
        bytes: { increment: BigInt(0) },
      }),
    }));
  });

  it('requires the upload scope before updating key state', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'read-key',
      hashedKey: expectedHash,
      revokedAt: null,
      scopes: 'read',
    });

    await expect(authenticateApiKey(makeRequest('stor_live_test'))).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('creates and returns the plaintext secret exactly once', async () => {
    createMock.mockImplementation(({ data }) => ({
      id: 'key-id',
      name: data.name,
      hashedKey: data.hashedKey,
      keyPrefix: 'stor_live_',
      lastFour: data.lastFour,
      scopes: data.scopes,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    }));

    const result = await createApiKey('Website');
    expect(result.name).toBe('Website');
    expect(result.secret).toMatch(/^stor_live_[A-Za-z0-9_-]{32,}$/);
    expect(result).not.toHaveProperty('hashedKey');
  });

  it('authenticates a matching key and updates usage', async () => {
    const secret = 'stor_live_test';
    const result = {
      id: 'key-id',
      name: 'Website',
      secret,
    };
    updateMock.mockReset().mockResolvedValue({});
    const expectedHash = createHash('sha256').update(result.secret).digest('hex');
    findUniqueMock.mockImplementation(async ({ where }) =>
      where.hashedKey === expectedHash
        ? { id: 'key-id', hashedKey: expectedHash, revokedAt: null, scopes: 'upload,read' }
        : null
    );

    await expect(authenticateApiKey(makeRequest(result.secret))).resolves.toEqual({
      ok: true,
      keyId: 'key-id',
    });
    expect(updateMock).toHaveBeenCalled();
  });

  it('rejects missing keys without querying credentials', async () => {
    await expect(authenticateApiKey(makeRequest())).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('accepts a fresh Cloudinary-style signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = 'stor_live_test';
    const expectedHash = createHash('sha256').update(secret).digest('hex');
    const signature = createRequestSignature(secret, { folder: '/site' }, timestamp);
    const formData = new FormData();
    formData.set('api_key', secret);
    formData.set('folder', '/site');
    formData.set('timestamp', String(timestamp));
    formData.set('api_signature', signature);
    findUniqueMock.mockResolvedValue({
      id: 'signed-key',
      hashedKey: expectedHash,
      revokedAt: null,
      scopes: 'upload,read',
    });
    updateMock.mockResolvedValue({});

    await expect(
      authenticateApiKey(makeRequest(), formData)
    ).resolves.toEqual({ ok: true, keyId: 'signed-key' });
  });
});
