// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  createInsightMock: vi.fn(),
  getFromStorageMock: vi.fn(),
  analyzeMock: vi.fn(),
  serializeImageMock: vi.fn((image: unknown) => image),
  authorizeMock: vi.fn(),
  recordUsageMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: { findUnique: mocks.findUniqueMock, update: mocks.updateMock },
    aiInsight: { create: mocks.createInsightMock },
  },
}));

vi.mock('@/lib/storage', () => ({ getFromStorage: mocks.getFromStorageMock }));
vi.mock('@/lib/ai-vision', () => ({ analyzeImageWithVision: mocks.analyzeMock }));
vi.mock('@/lib/utils', () => ({ serializeImage: mocks.serializeImageMock }));
vi.mock('next/server', () => {
  const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), init);
  return { NextResponse: { json: jsonResponse } };
});
vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: mocks.authorizeMock,
  recordManagementApiKeyUsage: mocks.recordUsageMock,
}));

const IMAGE = {
  id: 'img-1',
  originalName: 'a.png',
  storagePath: '2024/a.png',
  publicUrl: 'https://cdn.example/a.png',
  width: 10,
  height: 10,
  fileSize: 5,
  format: 'png',
  mimeType: 'image/png',
  folder: '/',
  tags: 'existing',
  altText: '',
  aiModerated: false,
  aiModerationScore: null,
  bgRemoved: false,
  compressed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const CONTEXT = { params: Promise.resolve({ id: 'img-1' }) };

function request(query = '') {
  return new Request(`http://localhost/api/images/img-1/ai${query}`, { method: 'POST' });
}

describe('POST /api/images/:id/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeMock.mockResolvedValue({ ok: true, keyId: null });
    mocks.getFromStorageMock.mockResolvedValue({
      buffer: Buffer.from('image'),
      contentType: IMAGE.mimeType,
    });
    mocks.updateMock.mockImplementation(async (_args, data) => ({ ...IMAGE, ...data }));
    mocks.createInsightMock.mockResolvedValue({});
  });

  it('requires write access before touching an asset', async () => {
    mocks.authorizeMock.mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' });
    const response = await POST(request(), CONTEXT);
    expect(response.status).toBe(403);
    expect(mocks.getFromStorageMock).not.toHaveBeenCalled();
  });

  it('merges generated metadata and stores a bounded insight', async () => {
    mocks.findUniqueMock.mockResolvedValue(IMAGE);
    mocks.analyzeMock.mockResolvedValue({
      provider: 'openai-compatible',
      model: 'vision',
      kind: 'tags,caption,moderation',
      tags: ['nature', 'existing'],
      altText: 'A landscape.',
      moderationScore: 0,
      isSafe: true,
      rawMetadata: '{}',
    });

    const response = await POST(
      request('?replace_metadata=true&tags=false&moderation=false'),
      CONTEXT
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.analyzeMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/png',
      expect.objectContaining({ tags: false })
    );
    expect(body.image.tags).toBe('existing');
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: 'img-1' },
      data: {
        altText: 'A landscape.',
      },
    });
    expect(body.image.tags).toBe('existing');
    expect(body.image.aiModerationScore).toBeNull();
    expect(mocks.createInsightMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageId: 'img-1', model: 'vision' }),
    });
    expect(mocks.recordUsageMock).toHaveBeenCalledWith(null, 'write', { assets: 1 });
  });

  it('maps storage failures to 502', async () => {
    mocks.findUniqueMock.mockResolvedValue(IMAGE);
    mocks.getFromStorageMock.mockRejectedValue(new Error('offline'));
    const response = await POST(request(), CONTEXT);
    expect(response.status).toBe(502);
    expect(mocks.recordUsageMock).toHaveBeenCalledWith(null, 'write', { errors: 1 });
  });

  it('returns 404 before storage access when the image is missing', async () => {
    mocks.findUniqueMock.mockResolvedValue(null);
    const response = await POST(request(), CONTEXT);
    expect(response.status).toBe(404);
    expect(mocks.getFromStorageMock).not.toHaveBeenCalled();
  });
});
