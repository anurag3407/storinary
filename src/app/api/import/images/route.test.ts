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
  getImageMetadata: vi.fn(),
  isSafeSvg: vi.fn(),
  serializeImage: vi.fn(),
  eagerTransforms: vi.fn(),
  dispatchWebhooks: vi.fn(),
  fetchRemoteAsset: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ authorizeDashboardOrApiKey: mocks.authorization }));
vi.mock('@/lib/prisma', () => ({ prisma: { image: { create: mocks.create } } }));
vi.mock('@/lib/storage', () => ({
  uploadToStorage: mocks.uploadToStorage,
  getPublicUrl: mocks.getPublicUrl,
  generateStorageKey: mocks.generateStorageKey,
}));
vi.mock('@/lib/image-processing', () => ({ getImageMetadata: mocks.getImageMetadata }));
vi.mock('@/lib/svg-security', () => ({ isSafeSvg: mocks.isSafeSvg }));
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  serializeImage: mocks.serializeImage,
}));
vi.mock('@/lib/eager-transforms', () => ({ generateEagerTransforms: mocks.eagerTransforms }));
vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: mocks.dispatchWebhooks }));
vi.mock('@/lib/remote-import', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/remote-import')>()),
  fetchRemoteAsset: mocks.fetchRemoteAsset,
}));

function request(body: unknown) {
  return new NextRequest('http://localhost/api/import/images', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorization.mockResolvedValue({ ok: true, keyId: null });
  mocks.serializeImage.mockImplementation((value) => value);
});

describe('POST /api/import/images', () => {
  it('requires authorization before fetching URLs', async () => {
    mocks.authorization.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' });
    const response = await POST(request({ urls: ['https://example.com/x.png'] }));
    expect(response.status).toBe(401);
    expect(mocks.fetchRemoteAsset).not.toHaveBeenCalled();
  });

  it('validates the payload without fetching', async () => {
    const response = await POST(request({ urls: [] }));
    expect(response.status).toBe(400);
    expect(mocks.fetchRemoteAsset).not.toHaveBeenCalled();
  });

  it('persists successful imports and emits webhooks', async () => {
    mocks.fetchRemoteAsset.mockResolvedValue({
      buffer: Buffer.from('image'),
      contentType: 'image/png',
      filename: 'x.png',
    });
    mocks.getImageMetadata.mockResolvedValue({ width: 2, height: 2, format: 'png', size: 5 });
    mocks.generateStorageKey.mockReturnValue('key.png');
    mocks.uploadToStorage.mockResolvedValue(undefined);
    mocks.getPublicUrl.mockReturnValue('https://cdn/key.png');
    mocks.create.mockResolvedValue({ id: 'img-1' });
    mocks.eagerTransforms.mockRejectedValue(new Error('ignored'));

    const response = await POST(request({
      urls: ['https://example.com/x.png'],
      folder: '/import',
      tags: 'remote',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.dispatchWebhooks).toHaveBeenCalledWith('image.uploaded', { image: { id: 'img-1' } });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ folder: '/import', tags: 'remote', originalName: 'x.png' }),
    });
  });

  it('reports individual failures while preserving batch behavior', async () => {
    mocks.fetchRemoteAsset
      .mockResolvedValueOnce({ buffer: Buffer.from('image'), contentType: 'image/png', filename: 'ok.png' })
      .mockRejectedValueOnce(new Error('Remote server returned 404'));
    mocks.getImageMetadata.mockResolvedValue({ width: 2, height: 2, format: 'png', size: 5 });
    mocks.generateStorageKey.mockReturnValue('key.png');
    mocks.uploadToStorage.mockResolvedValue(undefined);
    mocks.getPublicUrl.mockReturnValue('https://cdn/key.png');
    mocks.create.mockResolvedValue({ id: 'img-1' });
    mocks.eagerTransforms.mockRejectedValue(new Error('ignored'));

    const response = await POST(request({ urls: ['https://example.com/ok.png', 'https://example.com/bad.png'] }));
    const body = await response.json();
    expect(body.images).toHaveLength(1);
    expect(body.errors[0].error).toBe('Remote server returned 404');
  });
});
