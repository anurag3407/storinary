// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const { deleteFromStorageMock } = vi.hoisted(() => ({
  deleteFromStorageMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/storage', () => ({
  deleteFromStorage: deleteFromStorageMock,
}));

const {
  orgFindUniqueMock,
  apiKeyFindUniqueMock,
  imageFindFirstMock,
  imageDeleteMock,
  videoFindFirstMock,
  videoDeleteMock,
} = vi.hoisted(() => ({
  orgFindUniqueMock: vi.fn(),
  apiKeyFindUniqueMock: vi.fn(),
  imageFindFirstMock: vi.fn(),
  imageDeleteMock: vi.fn().mockResolvedValue({ id: 'img-1' }),
  videoFindFirstMock: vi.fn(),
  videoDeleteMock: vi.fn().mockResolvedValue({ id: 'vid-1' }),
}));

vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: orgFindUniqueMock },
    apiKey: { findUnique: apiKeyFindUniqueMock },
    image: { findFirst: imageFindFirstMock, delete: imageDeleteMock },
    video: { findFirst: videoFindFirstMock, delete: videoDeleteMock },
  };
  return { prisma: scoped, rawPrisma: scoped };
});

vi.mock('@/lib/api-keys', () => ({
  recordApiKeyUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/webhooks', () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
}));

describe('Cloudinary REST API POST /api/v1_1/:cloudName/:resourceType/destroy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgFindUniqueMock.mockResolvedValue({ id: 'org-123', slug: 'demo' });
    apiKeyFindUniqueMock.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-123',
      revokedAt: null,
    });
  });

  it('rejects request without api_key', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/destroy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: 'sample' }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toContain('Must supply api_key');
  });

  it('destroys an existing image and returns { result: "ok" }', async () => {
    imageFindFirstMock.mockResolvedValue({
      id: 'img-1',
      storagePath: 'demo/sample.jpg',
    });

    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/destroy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_id: 'sample',
        api_key: 'stor_live_valid',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe('ok');
    expect(deleteFromStorageMock).toHaveBeenCalledWith('demo/sample.jpg');
    expect(imageDeleteMock).toHaveBeenCalledWith({ where: { id: 'img-1' } });
  });

  it('returns { result: "not found" } when asset does not exist', async () => {
    imageFindFirstMock.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/destroy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_id: 'nonexistent',
        api_key: 'stor_live_valid',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe('not found');
  });
});
