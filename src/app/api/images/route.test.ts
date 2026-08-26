// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET } from './route';

const { imageMock, bulkDeleteFromStorageMock } = vi.hoisted(() => ({
  imageMock: {
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  bulkDeleteFromStorageMock: vi.fn(),
}));

const { readAuthMock, recordUsageMock } = vi.hoisted(() => ({
  readAuthMock: vi.fn(),
  recordUsageMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: imageMock,
  },
}));

const { dispatchWebhooksMock } = vi.hoisted(() => ({ dispatchWebhooksMock: vi.fn() }));

vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: dispatchWebhooksMock }));

vi.mock('@/lib/storage', () => ({
  bulkDeleteFromStorage: bulkDeleteFromStorageMock,
}));

vi.mock('@/lib/media-auth', () => ({ authorizeDashboardOrReadApiKey: readAuthMock }));

vi.mock('@/lib/api-keys', () => ({ recordApiKeyUsage: recordUsageMock }));

const MOCK_ROW = {
  id: 'img-1',
  originalName: 'a.webp',
  storagePath: '2024/01/a.webp',
  publicUrl: 'https://cdn.example/a.webp',
  width: 100,
  height: 100,
  fileSize: 1000,
  format: 'webp',
  mimeType: 'image/webp',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  aiModerated: false,
  aiModerationScore: null,
  compressed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

describe('GET /api/images', () => {
  beforeEach(() => {
    readAuthMock.mockReset().mockResolvedValue({ ok: true, keyId: 'read-key' });
    recordUsageMock.mockReset().mockResolvedValue(undefined);
    imageMock.findMany.mockReset();
    imageMock.count.mockReset();
  });

  it('lists images with pagination', async () => {
    imageMock.findMany.mockResolvedValue([MOCK_ROW]);
    imageMock.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/images?page=1&limit=20');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.images).toHaveLength(1);
    expect(body.images[0].id).toBe('img-1');
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(readAuthMock).toHaveBeenCalledWith(request);
    expect(recordUsageMock).toHaveBeenCalledWith('read-key', 'read', { assets: 1 });
  });

  it('rejects requests without dashboard or read-key authorization', async () => {
    readAuthMock.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' });

    const response = await GET(new NextRequest('http://localhost/api/images'));

    expect(response.status).toBe(401);
    expect(imageMock.findMany).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it('passes search and folder filters', async () => {
    imageMock.findMany.mockResolvedValue([]);
    imageMock.count.mockResolvedValue(0);

    const request = new NextRequest(
      'http://localhost/api/images?search=cat&folder=%2Fpets&sort=fileSize&order=asc'
    );
    await GET(request);

    expect(imageMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          folder: '/pets',
          OR: [
            { originalName: { contains: 'cat' } },
            { tags: { contains: 'cat' } },
            { altText: { contains: 'cat' } },
          ],
        }),
      })
    );
  });

  it('clamps page and limit to valid ranges', async () => {
    imageMock.findMany.mockResolvedValue([]);
    imageMock.count.mockResolvedValue(0);

    const request = new NextRequest(
      'http://localhost/api/images?page=0&limit=9999'
    );
    await GET(request);

    expect(imageMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 })
    );
  });
});

describe('DELETE /api/images', () => {
  beforeEach(() => {
    imageMock.findMany.mockReset();
    imageMock.deleteMany.mockReset();
    bulkDeleteFromStorageMock.mockReset();
  });

  it('rejects an empty ids list', async () => {
    const request = new NextRequest('http://localhost/api/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it('rejects more than 100 ids', async () => {
    const request = new NextRequest('http://localhost/api/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from({ length: 101 }, (_, i) => `id-${i}`) }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it('deletes from storage and db and returns counts', async () => {
    imageMock.findMany.mockResolvedValue([{ id: 'img-1', storagePath: '2024/01/a.webp' }]);
    imageMock.deleteMany.mockResolvedValue({ count: 1 });
    bulkDeleteFromStorageMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['img-1'] }),
    });
    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, deleted: 1, errors: [] });
    expect(bulkDeleteFromStorageMock).toHaveBeenCalledWith(['2024/01/a.webp']);
  });

  it('reports storage failures without blocking the db delete', async () => {
    imageMock.findMany.mockResolvedValue([{ id: 'img-1', storagePath: '2024/01/a.webp' }]);
    imageMock.deleteMany.mockResolvedValue({ count: 1 });
    bulkDeleteFromStorageMock.mockRejectedValue(new Error('storage down'));

    const request = new NextRequest('http://localhost/api/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['img-1'] }),
    });
    const response = await DELETE(request);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.deleted).toBe(1);
    expect(body.errors).toHaveLength(1);
  });
});
