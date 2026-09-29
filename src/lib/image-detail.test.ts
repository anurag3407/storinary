import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { image: { findUnique: findUniqueMock } },
  rawPrisma: {},
}));

import { getImageDetail, ImageDetailError } from './image-detail';

const ROW = {
  id: 'img-1',
  originalName: 'a.webp',
  storagePath: 'acme/2024/01/a.webp',
  publicUrl: 'https://cdn.example/acme/2024/01/a.webp',
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
  metadata: [],
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

describe('getImageDetail', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns null for a genuinely missing image', async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(getImageDetail('missing')).resolves.toBeNull();
  });

  it('returns detail for an existing image', async () => {
    findUniqueMock.mockResolvedValue(ROW);
    const result = await getImageDetail('img-1');
    expect(result?.image.id).toBe('img-1');
  });

  it('throws an ImageDetailError when the database lookup fails', async () => {
    findUniqueMock.mockRejectedValue(new Error('connection refused'));
    await expect(getImageDetail('img-1')).rejects.toBeInstanceOf(ImageDetailError);
  });
});
