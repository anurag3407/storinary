// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  create: vi.fn(),
  uploadToStorage: vi.fn(),
  getPublicUrl: vi.fn(),
  generateStorageKey: vi.fn(),
  getVideoMetadata: vi.fn(),
  isFfmpegAvailable: vi.fn(),
  serializeVideo: vi.fn(),
  dispatchWebhooks: vi.fn(),
  fetchRemoteAsset: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ authorizeDashboardOrApiKey: mocks.authorization }));
vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org-1', slug: 'acme' }) },
    video: { create: mocks.create, findUniqueOrThrow: mocks.create },
  };
  return { prisma: scoped, rawPrisma: scoped };
});
vi.mock('@/lib/storage', () => ({
  uploadToStorage: mocks.uploadToStorage,
  getPublicUrl: mocks.getPublicUrl,
  generateStorageKey: mocks.generateStorageKey,
}));
vi.mock('@/lib/video-metadata', () => ({ getVideoMetadata: mocks.getVideoMetadata }));
vi.mock('@/lib/video-renditions', () => ({
  isFfmpegAvailable: mocks.isFfmpegAvailable,
  createVideoFramePoster: vi.fn(),
  createVideoRendition: vi.fn(),
  RENDITION_PRESETS: {},
}));
vi.mock('@/lib/video-helpers', () => ({
  serializeVideo: mocks.serializeVideo,
}));
vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: mocks.dispatchWebhooks }));
vi.mock('@/lib/remote-import', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/remote-import')>()),
  fetchRemoteAsset: mocks.fetchRemoteAsset,
}));

function request(body: unknown) {
  return new NextRequest('http://localhost/api/import/videos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorization.mockResolvedValue({ ok: true, keyId: null, organizationId: 'org-1' });
  mocks.serializeVideo.mockImplementation((value) => value);
  mocks.isFfmpegAvailable.mockResolvedValue(false);
});

describe('POST /api/import/videos', () => {
  it('requires authorization before fetching URLs', async () => {
    mocks.authorization.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' });
    const response = await POST(request({ urls: ['https://example.com/x.mp4'] }));
    expect(response.status).toBe(401);
    expect(mocks.fetchRemoteAsset).not.toHaveBeenCalled();
  });

  it('validates the payload without fetching', async () => {
    const response = await POST(request({ urls: [] }));
    expect(response.status).toBe(400);
    expect(mocks.fetchRemoteAsset).not.toHaveBeenCalled();
  });

  it('persists successful video import', async () => {
    mocks.fetchRemoteAsset.mockResolvedValue({
      buffer: Buffer.from('video-data'),
      contentType: 'video/mp4',
      filename: 'sample.mp4',
    });
    mocks.getVideoMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      duration: 12,
      format: 'mp4',
    });
    mocks.generateStorageKey.mockReturnValue('sample-key.mp4');
    mocks.uploadToStorage.mockResolvedValue(undefined);
    mocks.getPublicUrl.mockReturnValue('https://cdn/sample-key.mp4');
    mocks.create.mockResolvedValue({ id: 'vid-1' });

    const response = await POST(request({
      urls: ['https://example.com/sample.mp4'],
      folder: '/videos',
      tags: 'remote',
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        originalName: 'sample.mp4',
        folder: '/videos',
      }),
    });
    expect(mocks.dispatchWebhooks).toHaveBeenCalledWith('video.uploaded', { video: { id: 'vid-1' } });
  });

  it('rejects video import if file size exceeds 100 MB free quota limit', async () => {
    mocks.fetchRemoteAsset.mockResolvedValue({
      buffer: Buffer.alloc(105 * 1024 * 1024), // 105 MB > 100 MB limit
      contentType: 'video/mp4',
      filename: 'large.mp4',
    });

    const response = await POST(request({ urls: ['https://example.com/large.mp4'] }));
    const body = await response.json();

    expect(body.videos).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].error).toContain('Storage quota exceeded');
    expect(mocks.uploadToStorage).not.toHaveBeenCalled();
  });
});
