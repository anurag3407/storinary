import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  DEFAULT_UPLOAD_OPTIONS,
  formatBytes,
  formatRelativeTime,
  loadUploadDefaults,
  sanitizeUploadDefaults,
  saveUploadDefaults,
  UPLOAD_DEFAULTS_KEY,
  validateFile,
} from './upload-helpers';

describe('validateFile', () => {
  it('accepts allowed formats under the size limit', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateFile(file)).toBeNull();
  });

  it('rejects unsupported formats', () => {
    const file = new File(['x'], 'a.bin', { type: 'application/zip' });
    expect(validateFile(file)).toContain('Unsupported format');
  });

  it('rejects files over the size limit', () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    expect(validateFile(big)).toContain('File too large');
  });
});

describe('sanitizeUploadDefaults', () => {
  it('returns defaults for null/undefined/non-objects', () => {
    expect(sanitizeUploadDefaults(null)).toEqual(DEFAULT_UPLOAD_OPTIONS);
    expect(sanitizeUploadDefaults(undefined)).toEqual(DEFAULT_UPLOAD_OPTIONS);
    expect(sanitizeUploadDefaults('nope')).toEqual(DEFAULT_UPLOAD_OPTIONS);
  });

  it('coerces booleans and numbers with fallbacks', () => {
    const result = sanitizeUploadDefaults({
      compress: 'false', // string — should be ignored
      quality: 999,
      maxWidth: -10,
      folder: '/hero/',
      tags: 'a,b',
      removeBg: true,
    });
    expect(result.compress).toBe(true); // default kept
    expect(result.quality).toBe(80); // out of range → default
    expect(result.maxWidth).toBe(2048); // out of range → default
    expect(result.folder).toBe('/hero'); // normalized
    expect(result.tags).toBe('a,b');
    expect(result.removeBg).toBe(true);
  });

  it('keeps valid values', () => {
    const result = sanitizeUploadDefaults({
      compress: false,
      quality: 60,
      maxWidth: 1024,
      folder: '/blog',
      tags: '',
      removeBg: false,
      moderate: false,
    });
    expect(result).toEqual({
      compress: false,
      quality: 60,
      maxWidth: 1024,
      removeBg: false,
      moderate: false,
      folder: '/blog',
      tags: '',
    });
  });
});

describe('loadUploadDefaults / saveUploadDefaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadUploadDefaults()).toEqual(DEFAULT_UPLOAD_OPTIONS);
  });

  it('round-trips saved defaults', () => {
    saveUploadDefaults({ ...DEFAULT_UPLOAD_OPTIONS, quality: 55, folder: '/x' });
    const loaded = loadUploadDefaults();
    expect(loaded.quality).toBe(55);
    expect(loaded.folder).toBe('/x');
    expect(window.localStorage.getItem(UPLOAD_DEFAULTS_KEY)).toContain('55');
  });

  it('returns defaults when stored JSON is malformed', () => {
    window.localStorage.setItem(UPLOAD_DEFAULTS_KEY, '{not json');
    expect(loadUploadDefaults()).toEqual(DEFAULT_UPLOAD_OPTIONS);
  });

  it('returns defaults when localStorage access throws', () => {
    // The polyfill installed by vitest.setup.ts is a plain object, so spy on
    // its own getItem (window.localStorage.getItem) rather than Storage.prototype.
    const getItem = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    expect(loadUploadDefaults()).toEqual(DEFAULT_UPLOAD_OPTIONS);
    getItem.mockRestore();
  });
});

describe('formatBytes', () => {
  it('formats 0 and small values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats KB, MB, GB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
    expect(formatBytes(20480)).toBe('20 KB');
  });
});

describe('formatRelativeTime', () => {
  it('handles various time deltas', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30 * 1000))).toBe('just now');
    expect(formatRelativeTime(new Date(now - 5 * 60 * 1000))).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 3600 * 1000))).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 10 * 24 * 3600 * 1000))).toBe(
      '10d ago'
    );
  });

  it('falls back to a locale date for old timestamps', () => {
    const old = new Date('2020-01-01T00:00:00Z');
    expect(formatRelativeTime(old)).toBe(old.toLocaleDateString());
  });
});

describe('compressImage', () => {
  it('passes SVG files through without compression', async () => {
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    const result = await compressImage(svg);
    expect(result).toBe(svg);
  });
});
