// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH } from './route';

const {
  imageMock,
  deleteFromStorageMock,
  imageVersionCreateMock,
  imageVersionFindFirstMock,
  getImageMetadataMock,
  generateShortIdMock,
} = vi.hoisted(() => ({
  imageMock: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  deleteFromStorageMock: vi.fn(),
  imageVersionCreateMock: vi.fn(),
  imageVersionFindFirstMock: vi.fn(),
  getImageMetadataMock: vi.fn(),
  generateShortIdMock: vi.fn(),
}));

const { dispatchWebhooksMock } = vi.hoisted(() => ({ dispatchWebhooksMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: imageMock,
    imageVersion: {
      create: imageVersionCreateMock,
      findFirst: imageVersionFindFirstMock,
    },
  },
}));

vi.mock('@/lib/storage', async () => ({
  ...await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage'),
  deleteFromStorage: deleteFromStorageMock,
}));

vi.mock('@/lib/image-processing', () => ({ getImageMetadata: getImageMetadataMock }));

vi.mock('@/lib/utils', async () => ({
  ...await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils'),
  generateShortId: generateShortIdMock,
}));

vi.mock('@/lib/svg-security', () => ({ isSafeSvg: vi.fn().mockResolvedValue(true) }));

vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: dispatchWebhooksMock }));

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
  versions: [],
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const context = { params: Promise.resolve({ id: 'img-1' }) };

describe('GET /api/images/:id', () => {
  beforeEach(() => imageMock.findUnique.mockReset());

  it('returns the image with generated links', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    const request = new NextRequest('http://localhost/api/images/img-1');
    const response = await GET(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.image.id).toBe('img-1');
    expect(body.links.transformBase).toContain('/api/serve/2024/01/a.webp');
  });

  it('returns 404 for a missing image', async () => {
    imageMock.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/images/missing');
    const response = await GET(request, context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});

describe('DELETE /api/images/:id', () => {
  beforeEach(() => {
    imageMock.findUnique.mockReset();
    imageMock.delete.mockReset();
    deleteFromStorageMock.mockReset();
    dispatchWebhooksMock.mockReset();
  });

  it('deletes storage and db for an existing image', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    imageMock.delete.mockResolvedValue(MOCK_ROW);

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(deleteFromStorageMock).toHaveBeenCalledWith('2024/01/a.webp');
    expect(imageMock.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
  });

  it('still deletes the db row when storage deletion fails', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    imageMock.delete.mockResolvedValue(MOCK_ROW);
    deleteFromStorageMock.mockRejectedValue(new Error('storage down'));

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, context);
    expect(response.status).toBe(200);
    expect(imageMock.delete).toHaveBeenCalled();
  });

  it('returns 404 for a missing image', async () => {
    imageMock.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/images/missing', {
      method: 'DELETE',
    });
    const response = await DELETE(request, context);
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/images/:id', () => {
  beforeEach(() => {
    imageMock.findUnique.mockReset();
    imageMock.update.mockReset();
    dispatchWebhooksMock.mockReset();
    imageVersionCreateMock.mockReset();
    imageVersionFindFirstMock.mockReset().mockResolvedValue({ version: 1 });
    getImageMetadataMock.mockReset();
    generateShortIdMock.mockReset().mockReturnValue('replacement-id');
  });

  it('updates provided metadata fields', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);
    imageMock.update.mockResolvedValue({ ...MOCK_ROW, tags: 'hero' });

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'hero', altText: 'Nice', bogus: 1 }),
    });
    const response = await PATCH(request, context);

    expect(response.status).toBe(200);
    expect(imageMock.update).toHaveBeenCalledWith({
      where: { id: 'img-1' },
      data: { tags: 'hero', altText: 'Nice' },
    });
  });

  it('rejects when no valid fields are present', async () => {
    imageMock.findUnique.mockResolvedValue(MOCK_ROW);

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bogus: 1 }),
    });
    const response = await PATCH(request, context);
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing image', async () => {
    imageMock.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/images/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'x' }),
    });
    const response = await PATCH(request, context);
    expect(response.status).toBe(404);
  });

  it('archives the current file and stores a replacement', async () => {
    imageMock.findUnique.mockResolvedValue({
      ...MOCK_ROW,
      versions: [{ id: 'v1', version: 1, createdAt: new Date() }],
    });
    imageVersionCreateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'archived', version: 2, createdAt: new Date(), ...data })
    );
    getImageMetadataMock.mockResolvedValue({ width: 320, height: 240, format: 'png', size: 7 });
    imageMock.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...MOCK_ROW, ...data, updatedAt: new Date() })
    );

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: {
        name: 'new.png',
        type: 'image/png',
        data: Buffer.from('replace').toString('base64'),
      } }),
    });
    const response = await PATCH(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(imageVersionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ storagePath: '2024/01/a.webp', label: 'replaced' }),
    });
    expect(body.storagePath).toContain('new-replacement-id.png');
    expect(dispatchWebhooksMock).toHaveBeenCalledWith(
      'image.updated',
      expect.objectContaining({ action: 'replaced' })
    );
  });

  it('restores a historical image without deleting its bytes', async () => {
    imageMock.findUnique.mockResolvedValue({
      ...MOCK_ROW,
      versions: [{
        id: 'history-1', imageId: 'img-1', version: 2,
        label: 'original', originalName: 'old.webp',
        storagePath: '2024/01/old.webp', publicUrl: 'https://cdn.example/old.webp',
        width: 10, height: 20, fileSize: 30, format: 'webp', mimeType: 'image/webp',
        createdAt: new Date(),
      }],
    });
    imageVersionCreateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'current-archive', version: 3, createdAt: new Date(), ...data })
    );
    imageMock.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...MOCK_ROW, ...data, updatedAt: new Date() })
    );

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreVersionId: 'history-1' }),
    });
    const response = await PATCH(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.originalName).toBe('old.webp');
    expect(deleteFromStorageMock).not.toHaveBeenCalled();
    expect(imageMock.update).toHaveBeenCalledWith({
      where: { id: 'img-1' },
      data: expect.objectContaining({ storagePath: '2024/01/old.webp' }),
    });
    expect(dispatchWebhooksMock).toHaveBeenCalledWith(
      'image.updated',
      expect.objectContaining({ action: 'restored' })
    );
  });
});
