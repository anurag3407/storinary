// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  createInsightMock: vi.fn(),
  getFromStorageMock: vi.fn(),
  createPosterMock: vi.fn(),
  analyzeMock: vi.fn(),
  serializeVideoMock: vi.fn((video: unknown) => video),
  serializeVersionMock: vi.fn((version: unknown) => version),
  normalizeHlsMock: vi.fn((item: unknown) => item),
  normalizeDashMock: vi.fn((item: unknown) => item),
  authorizeMock: vi.fn(),
  recordUsageMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findUnique: mocks.findUniqueMock, update: mocks.updateMock },
    aiInsight: { create: mocks.createInsightMock },
  },
}));

vi.mock('@/lib/storage', () => ({ getFromStorage: mocks.getFromStorageMock }));
vi.mock('@/lib/ai-vision', () => ({ analyzeImageWithVision: mocks.analyzeMock }));
vi.mock('@/lib/video-renditions', () => ({
  createVideoFramePoster: mocks.createPosterMock,
}));
vi.mock('@/lib/video-dash', () => ({ normalizeDashPackage: mocks.normalizeDashMock }));
vi.mock('@/lib/video-hls', () => ({ normalizeHlsPackage: mocks.normalizeHlsMock }));
vi.mock('@/lib/asset-versions', () => ({
  serializeVideoVersion: mocks.serializeVersionMock,
}));
vi.mock('@/lib/video-helpers', () => ({ serializeVideo: mocks.serializeVideoMock }));
vi.mock('@/lib/media-management-auth', () => ({
  authorizeDashboardOrWriteApiKey: mocks.authorizeMock,
  recordManagementApiKeyUsage: mocks.recordUsageMock,
}));

const VIDEO = {
  id: 'video-1',
  storagePath: 'videos/demo.mp4',
  posterPath: 'videos/demo.webp',
  tags: 'existing',
  altText: '',
  aiModerated: false,
  aiModerationScore: null,
};

const CONTEXT = { params: Promise.resolve({ id: 'video-1' }) };

function request(query = '') {
  return new Request(`http://localhost/api/videos/video-1/ai${query}`, { method: 'POST' });
}

describe('POST /api/videos/:id/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUniqueMock.mockResolvedValue(VIDEO);
    mocks.authorizeMock.mockResolvedValue({ ok: true, keyId: null });
    mocks.getFromStorageMock.mockImplementation(async (path: string) => ({
      buffer: Buffer.from(path === VIDEO.posterPath ? 'poster' : 'video'),
      contentType: path === VIDEO.posterPath ? 'image/webp' : 'video/mp4',
    }));
    mocks.analyzeMock.mockResolvedValue({
      provider: 'openai-compatible',
      model: 'vision',
      kind: 'tags,caption,moderation',
      tags: ['city'],
      altText: 'A city street.',
      moderationScore: 0.1,
      isSafe: true,
      rawMetadata: '{"requestedFeatures":["tags"]}',
    });
    mocks.updateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...VIDEO,
        ...data,
        renditions: [],
        hlsPackages: [],
        dashPackages: [],
        versions: [],
      })
    );
    mocks.createInsightMock.mockResolvedValue({});
  });

  it('requires write access before reading a source file', async () => {
    mocks.authorizeMock.mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' });
    const response = await POST(request(), CONTEXT);
    expect(response.status).toBe(403);
    expect(mocks.getFromStorageMock).not.toHaveBeenCalled();
  });

  it('analyzes the stored poster and records the provenance', async () => {
    const response = await POST(request('?replace_metadata=true'), CONTEXT);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getFromStorageMock).toHaveBeenNthCalledWith(1, VIDEO.storagePath);
    expect(mocks.getFromStorageMock).toHaveBeenNthCalledWith(2, VIDEO.posterPath);
    expect(mocks.createPosterMock).not.toHaveBeenCalled();
    expect(mocks.updateMock.mock.calls[0][0].data).toEqual({
      tags: 'city',
      altText: 'A city street.',
      aiModerated: true,
      aiModerationScore: 0.1,
    });
    expect(body.video.tags).toBe('city');
    expect(mocks.createInsightMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        videoId: 'video-1',
        rawMetadata:
          '{"requestedFeatures":["tags"],"analyzedSource":"stored-poster"}',
      }),
    });
    expect(mocks.recordUsageMock).toHaveBeenCalledWith(null, 'write', { assets: 1 });
  });

  it('extracts a frame when no stored poster exists', async () => {
    mocks.findUniqueMock.mockResolvedValue({ ...VIDEO, posterPath: null });
    mocks.createPosterMock.mockResolvedValue(Buffer.from('frame'));
    const response = await POST(request(), CONTEXT);

    expect(response.status).toBe(200);
    expect(mocks.createPosterMock).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mocks.analyzeMock.mock.calls[0][1]).toBe('image/webp');
  });

  it('maps storage failures to 502', async () => {
    mocks.findUniqueMock.mockResolvedValue(VIDEO);
    mocks.getFromStorageMock.mockRejectedValue(new Error('offline'));
    const response = await POST(request(), CONTEXT);
    expect(response.status).toBe(502);
    expect(mocks.recordUsageMock).toHaveBeenCalledWith(null, 'write', { errors: 1 });
  });
});
