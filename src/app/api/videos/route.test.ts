// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const { authMock, createMock, metadataMock, publicUrlMock, storageKeyMock, uploadMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createMock: vi.fn(),
  metadataMock: vi.fn(),
  publicUrlMock: vi.fn(),
  storageKeyMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({
  authenticateVideoApiKey: authMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { video: { create: createMock } } }));
vi.mock('@/lib/video-metadata', () => ({ getVideoMetadata: metadataMock }));
vi.mock('@/lib/storage', () => ({
  generateStorageKey: storageKeyMock,
  getPublicUrl: publicUrlMock,
  uploadToStorage: uploadMock,
}));

const VIDEO = {
  id: 'video-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('POST /api/videos', () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ ok: true, keyId: 'key' });
    metadataMock.mockReset().mockResolvedValue({ width: 0, height: 0, duration: 5, format: 'mp4' });
    storageKeyMock.mockReset().mockReturnValue('2026/08/test-video-key.mp4');
    uploadMock.mockReset().mockResolvedValue(undefined);
    publicUrlMock.mockReset().mockReturnValue('https://cdn.example/video.mp4');
    createMock.mockReset().mockResolvedValue({ ...VIDEO });
  });

  it('uploads a valid authenticated MP4', async () => {
    const formData = new FormData();
    formData.append('file', new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    const request = new NextRequest('http://localhost/api/videos', {
      method: 'POST',
      headers: { 'x-api-key': 'stor_live_test' },
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(uploadMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ format: 'mp4', duration: 5 }),
    });
  });

  it('rejects invalid credentials before reading files', async () => {
    authMock.mockResolvedValue({ ok: false, status: 401, error: 'Invalid or revoked API key' });
    const request = new NextRequest('http://localhost/api/videos', { method: 'POST', body: new FormData() });

    expect((await POST(request)).status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });
});
