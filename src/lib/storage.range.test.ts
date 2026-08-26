// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getVideoFromStorage } from './storage';

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({ download: downloadMock }),
    },
  }),
}));

describe('getVideoFromStorage ranges', () => {
  const origEnv = process.env.STORAGE_PROVIDER;

  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'supabase';
    downloadMock.mockReset();
  });

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = origEnv;
    }
  });

  it('slices full downloads for non-range providers', async () => {
    downloadMock.mockResolvedValue({
      data: new Blob(['abcdefghij'], { type: 'video/mp4' }),
      error: null,
    });

    const result = await getVideoFromStorage('video.mp4', 'bytes=2-5');

    expect(result.buffer.toString()).toBe('cdef');
    expect(result.totalSize).toBe(10);
    expect(result.contentRange).toBe('bytes 2-5/10');
  });
});
