import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { collectArchiveEntries, createZipArchive } from './archive';

describe('archive helper', () => {
  it('creates deterministic-safe unique ZIP entries', async () => {
    const entries = await collectArchiveEntries(
      [
        { id: '1', originalName: 'photo.jpg', storagePath: 'a' },
        { id: '2', originalName: 'photo.jpg', storagePath: 'b' },
        { id: '3', originalName: '../evil.jpg', storagePath: 'c' },
      ],
      async (path) => ({ buffer: Buffer.from(`content-${path}`) })
    );

    expect(entries.map((entry) => entry.path)).toEqual([
      'storinary/photo.jpg',
      'storinary/photo-1.jpg',
      'storinary/..-evil.jpg',
    ]);

    const archive = createZipArchive(entries);
    const files = unzipSync(archive);
    expect(Object.keys(files)).toHaveLength(3);
    expect(Buffer.from(files['storinary/photo-1.jpg']).toString()).toBe('content-b');
  });

  it('enforces aggregate archive limits', async () => {
    const oversized = Buffer.alloc(100 * 1024 * 1024 + 1, 1);
    await expect(collectArchiveEntries(
      [{ id: '1', originalName: 'large.jpg', storagePath: 'large' }],
      async () => ({ buffer: oversized })
    )).rejects.toThrow('Archive entry too large');
  });
});
