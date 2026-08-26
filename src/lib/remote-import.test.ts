// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRemoteAsset,
  normalizeImportUrl,
  remoteFilename,
  validateImportPayload,
} from './remote-import';

const originalFetch = globalThis.fetch;

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
  default: { lookup: lookupMock },
}));

function mockLookup(address = '93.184.216.34') {
  lookupMock.mockResolvedValue([{ address, family: 4 }]);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('normalizeImportUrl', () => {
  it('accepts only public HTTPS URLs', () => {
    expect(normalizeImportUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
    expect(normalizeImportUrl('http://example.com/image.jpg')).toBeNull();
    expect(normalizeImportUrl('https://localhost/image.jpg')).toBeNull();
    expect(normalizeImportUrl('https://127.0.0.1/image.jpg')).toBeNull();
    expect(normalizeImportUrl('https://user:pass@example.com/image.jpg')).toBeNull();
  });
});

describe('validateImportPayload', () => {
  it('normalizes and bounds batches', () => {
    expect(validateImportPayload({ urls: ['https://example.com/a.png'], tags: ' imported ' }, 10)).toEqual({
      urls: ['https://example.com/a.png'],
      folder: '/',
      tags: 'imported',
    });
    expect(validateImportPayload({ urls: ['https://169.254.1.1/x'] }, 10)).toBe(
      'URLs must be public HTTPS addresses'
    );
    expect(validateImportPayload({ urls: [] }, 10)).toBe('At least one URL is required');
    expect(validateImportPayload({ urls: Array.from({ length: 11 }, () => 'https://example.com') }, 10)).toBe(
      'Maximum 10 URLs per request'
    );
  });
});

describe('fetchRemoteAsset', () => {
  const response = (body: BodyInit | null = 'image', init: ResponseInit = {}) =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'image/png', ...init.headers },
      ...init,
    });

  it('rejects DNS failures before fetching', async () => {
    mockLookup('192.168.1.10');
    await expect(fetchRemoteAsset('https://example.com/x.png', ['image/png'], 1000)).rejects.toThrow(
      'Host resolves to a private address'
    );
  });

  it('reports unresolvable hosts', async () => {
    lookupMock.mockRejectedValue(new Error('dns failure'));
    await expect(fetchRemoteAsset('https://example.com/x.png', ['image/png'], 1000)).rejects.toThrow(
      'Could not resolve import host'
    );
  });

  it('downloads an allowed response with bounded metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('png-bytes')));
    mockLookup();

    const result = await fetchRemoteAsset('https://example.com/banner', ['image/png'], 100);
    expect(result.buffer.toString()).toBe('png-bytes');
    expect(result.contentType).toBe('image/png');
    expect(result.filename).toBe('banner.png');
  });

  it('rejects unsupported types and oversized streams', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, { headers: { 'content-type': 'text/html' } })));
    mockLookup();
    await expect(fetchRemoteAsset('https://example.com/page', ['image/png'], 10)).rejects.toThrow(
      /Unsupported remote content type/
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response('0123456789'))
    );
    await expect(fetchRemoteAsset('https://example.com/big.png', ['image/png'], 5)).rejects.toThrow(
      /exceeds 0 MB limit/
    );
  });
});

describe('remoteFilename', () => {
  it('derives safe names from paths and content types', () => {
    expect(remoteFilename('https://example.com/assets/photo%20one.jpg', 'image/jpeg')).toBe('photo one.jpg');
    expect(remoteFilename('https://example.com/', 'video/mp4')).toBe('remote-asset.mp4');
  });
});
