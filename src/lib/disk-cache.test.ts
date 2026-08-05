// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { diskCache } from './disk-cache';

describe('diskCache', () => {
  beforeEach(async () => {
    await diskCache.clear();
  });

  afterEach(async () => {
    await diskCache.clear();
  });

  it('returns null on cache miss', async () => {
    const res = await diskCache.get('nonexistent-key');
    expect(res).toBeNull();
  });

  it('stores and retrieves binary transform entries', async () => {
    const key = 'test-key-123';
    const entry = {
      buffer: Buffer.from('fake-image-bytes'),
      contentType: 'image/webp',
    };

    await diskCache.set(key, entry);

    const cached = await diskCache.get(key);
    expect(cached).not.toBeNull();
    expect(cached?.contentType).toBe('image/webp');
    expect(cached?.buffer.toString()).toBe('fake-image-bytes');
  });

  it('tracks size and clears entries', async () => {
    await diskCache.set('key1', { buffer: Buffer.from('a'), contentType: 'image/jpeg' });
    await diskCache.set('key2', { buffer: Buffer.from('b'), contentType: 'image/png' });

    const size = await diskCache.size();
    expect(size).toBe(2);

    await diskCache.clear();
    const sizeAfterClear = await diskCache.size();
    expect(sizeAfterClear).toBe(0);
  });
});
