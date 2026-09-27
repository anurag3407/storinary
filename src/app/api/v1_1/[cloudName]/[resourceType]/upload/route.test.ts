// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const { uploadToStorageMock, getPublicUrlMock } = vi.hoisted(() => ({
  uploadToStorageMock: vi.fn().mockResolvedValue('https://storage.example.com/asset.jpg'),
  getPublicUrlMock: vi.fn((path: string) => `https://storage.example.com/${path}`),
}));

vi.mock('@/lib/storage', () => ({
  uploadToStorage: uploadToStorageMock,
  getPublicUrl: getPublicUrlMock,
  generateStorageKey: () => 'generated-key.jpg',
}));

const {
  orgFindUniqueMock,
  uploadPresetFindFirstMock,
  apiKeyFindUniqueMock,
  imageCreateMock,
  imageVersionCreateMock,
} = vi.hoisted(() => ({
  orgFindUniqueMock: vi.fn(),
  uploadPresetFindFirstMock: vi.fn(),
  apiKeyFindUniqueMock: vi.fn(),
  imageCreateMock: vi.fn(),
  imageVersionCreateMock: vi.fn().mockResolvedValue({ id: 'ver-1' }),
}));

vi.mock('@/lib/prisma', () => {
  const scoped = {
    organization: { findUnique: orgFindUniqueMock },
    uploadPreset: { findFirst: uploadPresetFindFirstMock },
    apiKey: { findUnique: apiKeyFindUniqueMock },
    image: { create: imageCreateMock },
    imageVersion: { create: imageVersionCreateMock },
  };
  return { prisma: scoped, rawPrisma: scoped };
});

vi.mock('@/lib/image-processing', () => ({
  getImageMetadata: vi.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpg' }),
}));

vi.mock('@/lib/api-keys', () => ({
  recordApiKeyUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/asset-versions', () => ({
  recordInitialImageVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/webhooks', () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
}));

describe('Cloudinary REST API POST /api/v1_1/:cloudName/:resourceType/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgFindUniqueMock.mockResolvedValue({ id: 'org-123', slug: 'demo' });
  });

  it('rejects upload when no API key or unsigned preset is supplied', async () => {
    const formData = new FormData();
    const file = new File(['test image data'], 'photo.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toContain('Must supply api_key or unsigned upload_preset');
  });

  it('accepts upload with unsigned upload_preset and returns Cloudinary JSON format', async () => {
    uploadPresetFindFirstMock.mockResolvedValue({
      id: 'preset-1',
      name: 'unsigned_preset',
      active: true,
      unsigned: true,
      organizationId: 'org-123',
    });

    imageCreateMock.mockResolvedValue({
      id: 'img-abc',
      originalName: 'photo.jpg',
      storagePath: 'demo/avatars/photo.jpg',
      publicUrl: 'https://storage.example.com/demo/avatars/photo.jpg',
      fileSize: 1024,
      width: 800,
      height: 600,
      format: 'jpg',
      mimeType: 'image/jpeg',
      folder: 'avatars',
      tags: 'user,profile',
    });

    const formData = new FormData();
    const file = new File(['test image content'], 'photo.jpg', { type: 'image/jpeg' });
    formData.append('file', file);
    formData.append('upload_preset', 'unsigned_preset');
    formData.append('folder', 'avatars');
    formData.append('tags', 'user,profile');

    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('public_id');
    expect(data).toHaveProperty('version');
    expect(data.resource_type).toBe('image');
    expect(data.width).toBe(800);
    expect(data.height).toBe(600);
    expect(data.format).toBe('jpg');
    expect(data.secure_url).toContain('/demo/image/upload/');
    expect(data.tags).toEqual(['user', 'profile']);
  });

  it('accepts upload via base64 data URI string and valid API key', async () => {
    apiKeyFindUniqueMock.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-123',
      revokedAt: null,
    });

    imageCreateMock.mockResolvedValue({
      id: 'img-data',
      originalName: 'data-upload.png',
      storagePath: 'demo/data-upload.png',
      publicUrl: 'https://storage.example.com/demo/data-upload.png',
      fileSize: 4,
      width: 800,
      height: 600,
      format: 'png',
      mimeType: 'image/png',
      folder: '/',
      tags: '',
    });

    // 1x1 transparent PNG in base64
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=';

    const req = new NextRequest('http://localhost:3000/api/v1_1/demo/image/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: base64Data,
        api_key: 'stor_live_mykey',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ cloudName: 'demo', resourceType: 'image' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resource_type).toBe('image');
    expect(uploadToStorageMock).toHaveBeenCalled();
  });
});
