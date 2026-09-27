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
    expect(
      transformCacheKey('2024/01/a.webp', {
        g: 'north',
        b: '#fff',
        a: 45,
        e: [{ grayscale: true }, { blur: 20 }],
        dpr: 2,
        text: 'Hello',
      })
    ).toBe('2024/01/a.webp?g=north&b=%23fff&a=45&e=grayscale%2Cblur%3A20&dpr=2&text=Hello');
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

  it('automatically computes ETag on set if omitted', () => {
    const cache = new TransformCache(10, 1024);
    cache.set('img', { buffer: Buffer.from('image-bytes'), contentType: 'image/png' });
    const entry = cache.get('img');
    expect(entry?.etag).toMatch(/^"[a-f0-9]{32}"$/);
  });
});

describe('HTTP 304 and ETag helpers', () => {
  it('correctly validates matching and non-matching ETags', async () => {
    const { computeEtag, isNotModified } = await import('./transform-cache');
    const etag = computeEtag(Buffer.from('hello-world'));
    
    // Exact match
    const req1 = new Request('http://localhost', { headers: { 'if-none-match': etag } });
    expect(isNotModified(req1, etag)).toBe(true);

    // Weak match
    const req2 = new Request('http://localhost', { headers: { 'if-none-match': `W/${etag}` } });
    expect(isNotModified(req2, etag)).toBe(true);

    // List of tags match
    const req3 = new Request('http://localhost', { headers: { 'if-none-match': `"other", ${etag}` } });
    expect(isNotModified(req3, etag)).toBe(true);

    // Wildcard
    const req4 = new Request('http://localhost', { headers: { 'if-none-match': '*' } });
    expect(isNotModified(req4, etag)).toBe(true);

    // Mismatch
    const req5 = new Request('http://localhost', { headers: { 'if-none-match': '"different"' } });
    expect(isNotModified(req5, etag)).toBe(false);

    // Header missing
    const req6 = new Request('http://localhost');
    expect(isNotModified(req6, etag)).toBe(false);
  });
});

describe('coalesceTransform', () => {
  it('coalesces concurrent requests for the same key into a single invocation', async () => {
    const { coalesceTransform } = await import('./transform-cache');
    let callCount = 0;

    const slowFactory = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { buffer: Buffer.from('data'), contentType: 'image/webp' };
    };

    // Run 5 concurrent requests
    const results = await Promise.all([
      coalesceTransform('concurrent-key', slowFactory),
      coalesceTransform('concurrent-key', slowFactory),
      coalesceTransform('concurrent-key', slowFactory),
      coalesceTransform('concurrent-key', slowFactory),
      coalesceTransform('concurrent-key', slowFactory),
    ]);

    expect(callCount).toBe(1);
    for (const res of results) {
      expect(res.buffer.toString()).toBe('data');
    }
  });
});
