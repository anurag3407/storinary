import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase client factory before importing the module under test
const {
  getPublicUrlMock,
  removeMock,
  downloadMock,
  uploadMock,
  listMock,
} = vi.hoisted(() => ({
  getPublicUrlMock: vi.fn(),
  removeMock: vi.fn(),
  downloadMock: vi.fn(),
  uploadMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: getPublicUrlMock,
        remove: removeMock,
        download: downloadMock,
        upload: uploadMock,
        list: listMock,
      })),
    },
  })),
}));

import {
  BUCKET,
  bulkDeleteFromStorage,
  deleteFromStorage,
  generateStorageKey,
  getFromStorage,
  getPublicUrl,
  listStorageObjects,
  uploadToStorage,
} from './storage';

describe('generateStorageKey', () => {
  it('builds {year}/{month}/{name}-{id}.{format}', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const key = generateStorageKey('My Photo.jpg', 'abc12345', 'webp');
    expect(key).toBe(`${year}/${month}/my-photo-abc12345.webp`);
  });

  it('sanitizes filenames and collapses separators', () => {
    const key = generateStorageKey('A  B--C__D!.png', 'xyz', 'png');
    expect(key).toMatch(/a-b-c-d-xyz\.png$/);
    expect(key).not.toContain('--');
  });

  it('truncates long base names to 50 chars', () => {
    const long = 'x'.repeat(120) + '.jpg';
    const key = generateStorageKey(long, 'id123', 'jpg');
    const base = key.split('/')[2].split('-')[0];
    expect(base.length).toBeLessThanOrEqual(50);
  });
});

describe('uploadToStorage', () => {
  beforeEach(() => uploadMock.mockReset());

  it('uploads with upsert and returns the key', async () => {
    uploadMock.mockResolvedValue({ error: null });
    await expect(
      uploadToStorage(Buffer.from('data'), '2024/01/x.webp', 'image/webp')
    ).resolves.toBe('2024/01/x.webp');
    expect(uploadMock).toHaveBeenCalledWith(
      '2024/01/x.webp',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/webp', upsert: true })
    );
  });

  it('throws when upload fails', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'bucket missing' } });
    await expect(
      uploadToStorage(Buffer.from('data'), 'k', 'image/webp')
    ).rejects.toThrow('Upload failed: bucket missing');
  });
});

describe('getFromStorage', () => {
  beforeEach(() => downloadMock.mockReset());

  it('returns buffer and content type', async () => {
    downloadMock.mockResolvedValue({
      data: new Blob(['img'], { type: 'image/webp' }),
      error: null,
    });
    const result = await getFromStorage('2024/01/x.webp');
    expect(result.contentType).toBe('image/webp');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString()).toBe('img');
  });

  it('throws when download errors', async () => {
    downloadMock.mockResolvedValue({ data: null, error: { message: 'gone' } });
    await expect(getFromStorage('missing')).rejects.toThrow('Download failed');
  });
});

describe('deleteFromStorage / bulkDeleteFromStorage', () => {
  beforeEach(() => removeMock.mockReset());

  it('deletes a single key', async () => {
    removeMock.mockResolvedValue({ error: null });
    await deleteFromStorage('2024/01/x.webp');
    expect(removeMock).toHaveBeenCalledWith(['2024/01/x.webp']);
  });

  it('bulk deletes multiple keys', async () => {
    removeMock.mockResolvedValue({ error: null });
    await bulkDeleteFromStorage(['a', 'b']);
    expect(removeMock).toHaveBeenCalledWith(['a', 'b']);
  });

  it('bulk delete is a no-op for empty arrays', async () => {
    await bulkDeleteFromStorage([]);
    expect(removeMock).not.toHaveBeenCalled();
  });
});

describe('listStorageObjects', () => {
  beforeEach(() => listMock.mockReset());

  it('maps objects with key and size', async () => {
    listMock.mockResolvedValue({
      data: [
        {
          name: 'x.webp',
          metadata: { size: 100 },
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const result = await listStorageObjects('folder');
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].key).toBe('folder/x.webp');
    expect(result.objects[0].size).toBe(100);
  });

  it('throws on error', async () => {
    listMock.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(listStorageObjects()).rejects.toThrow('List failed');
  });
});

describe('getPublicUrl', () => {
  it('returns the public URL from the client', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: `https://cdn.example/${BUCKET}/2024/01/x.webp` },
    });
    expect(getPublicUrl('2024/01/x.webp')).toContain('https://cdn.example');
  });
});
