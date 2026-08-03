// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TransformCache, transformCacheKey } from './transform-cache';

describe('transformCacheKey', () => {
  it('builds a canonical key from params', () => {
    expect(
      transformCacheKey('2024/01/a.webp', { w: 400, q: 70 })
    ).toBe('2024/01/a.webp?w=400&q=70');
    expect(transformCacheKey('2024/01/a.webp', { fmt: 'jpeg' })).toBe(
      '2024/01/a.webp?fmt=jpeg'
    );
    expect(transformCacheKey('2024/01/a.webp', {})).toBe('2024/01/a.webp');
  });
});

describe('TransformCache', () => {
  it('stores and retrieves entries', () => {
    const cache = new TransformCache(10, 1024);
    cache.set('a', { buffer: Buffer.from('one'), contentType: 'image/webp' });
    const hit = cache.get('a');
    expect(hit?.buffer.toString()).toBe('one');
    expect(hit?.contentType).toBe('image/webp');
  });

  it('returns undefined for misses', () => {
    const cache = new TransformCache(10, 1024);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry when over capacity', () => {
    const cache = new TransformCache(2, 1024);
    cache.set('a', { buffer: Buffer.from('1'), contentType: 'image/webp' });
    cache.set('b', { buffer: Buffer.from('2'), contentType: 'image/webp' });
    cache.get('a'); // touch a → b becomes LRU
    cache.set('c', { buffer: Buffer.from('3'), contentType: 'image/webp' });

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.buffer.toString()).toBe('1');
    expect(cache.get('c')?.buffer.toString()).toBe('3');
  });

  it('evicts by total bytes', () => {
    const cache = new TransformCache(100, 10); // tiny byte budget
    cache.set('a', { buffer: Buffer.from('123456'), contentType: 'image/webp' });
    cache.set('b', { buffer: Buffer.from('654321'), contentType: 'image/webp' });
    expect(cache.stats().entries).toBeLessThanOrEqual(1);
  });

  it('keeps the most recent entry when over byte budget', () => {
    const cache = new TransformCache(100, 10);
    cache.set('a', { buffer: Buffer.from('1111111111'), contentType: 'image/webp' });
    cache.set('b', { buffer: Buffer.from('22'), contentType: 'image/webp' });
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
  });

  it('updates an existing key and refreshes LRU order', () => {
    const cache = new TransformCache(2, 1024);
    cache.set('a', { buffer: Buffer.from('old'), contentType: 'image/webp' });
    cache.set('b', { buffer: Buffer.from('b'), contentType: 'image/webp' });
    cache.set('a', { buffer: Buffer.from('new'), contentType: 'image/jpeg' });

    expect(cache.get('a')?.buffer.toString()).toBe('new');
    expect(cache.get('a')?.contentType).toBe('image/jpeg');
  });

  it('reports stats and clears', () => {
    const cache = new TransformCache(10, 1024);
    cache.set('a', { buffer: Buffer.from('x'), contentType: 'image/webp' });
    expect(cache.stats()).toEqual({ entries: 1, bytes: 1 });
    cache.clear();
    expect(cache.stats()).toEqual({ entries: 0, bytes: 0 });
  });
});
