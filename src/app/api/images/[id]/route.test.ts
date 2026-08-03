// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH } from './route';

const { imageMock, deleteFromStorageMock } = vi.hoisted(() => ({
  imageMock: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  deleteFromStorageMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: imageMock,
  },
}));

vi.mock('@/lib/storage', () => ({
  deleteFromStorage: deleteFromStorageMock,
}));

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
  compressed: false,
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
});
