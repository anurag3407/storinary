import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const {
  authorizeDashboardOrReadApiKeyMock,
  authorizeDashboardOrScopedUploadApiKeyMock,
  checkStorageQuotaMock,
  videoFindManyMock,
  videoCountMock,
} = vi.hoisted(() => ({
  authorizeDashboardOrReadApiKeyMock: vi.fn(),
  authorizeDashboardOrScopedUploadApiKeyMock: vi.fn(),
  checkStorageQuotaMock: vi.fn(),
  videoFindManyMock: vi.fn(),
  videoCountMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findMany: videoFindManyMock,
      count: videoCountMock,
      create: vi.fn(),
    },
  },
  rawPrisma: {
    video: {
      findMany: videoFindManyMock,
      count: videoCountMock,
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/media-auth', () => ({
  authorizeDashboardOrReadApiKey: authorizeDashboardOrReadApiKeyMock,
  authorizeDashboardOrScopedUploadApiKey: authorizeDashboardOrScopedUploadApiKeyMock,
}));

vi.mock('@/lib/quota', () => ({
  checkStorageQuota: checkStorageQuotaMock,
}));

describe('videos API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/videos', () => {
    it('returns 401 when unauthorized', async () => {
      authorizeDashboardOrReadApiKeyMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: 'Unauthorized',
      });
      const req = new NextRequest('http://localhost:3000/api/videos');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns list of videos when authorized', async () => {
      authorizeDashboardOrReadApiKeyMock.mockResolvedValueOnce({
        ok: true,
        keyId: null,
        organizationId: 'org_123',
      });
      videoFindManyMock.mockResolvedValueOnce([]);
      videoCountMock.mockResolvedValueOnce(0);

      const req = new NextRequest('http://localhost:3000/api/videos');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.videos).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe('POST /api/videos quota check', () => {
    it('rejects video upload when quota is exceeded', async () => {
      authorizeDashboardOrScopedUploadApiKeyMock.mockResolvedValueOnce({
        ok: true,
        keyId: null,
        organizationId: 'org_123',
      });

      checkStorageQuotaMock.mockResolvedValueOnce({
        allowed: false,
        error: 'Storage quota exceeded (100 MB free tier limit)',
      });

      const formData = new FormData();
      const videoFile = new File([new Uint8Array(50 * 1024 * 1024)], 'clip.mp4', {
        type: 'video/mp4',
      });
      formData.append('file', videoFile);

      const req = new NextRequest('http://localhost:3000/api/videos', {
        method: 'POST',
      });
      req.formData = vi.fn().mockResolvedValue(formData);

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.quotaExceeded).toBe(true);
      expect(data.error).toContain('Storage quota exceeded');
    });
  });
});
