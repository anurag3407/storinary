import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClipboard } from './useClipboard';

describe('useClipboard', () => {
  it('copies via the clipboard API and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useClipboard());
    const ok = await result.current.copy('hello');

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when clipboard API fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;

    const { result } = renderHook(() => useClipboard());
    const ok = await result.current.copy('fallback text');

    expect(ok).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns false when both methods fail', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    document.execCommand = vi.fn(() => {
      throw new Error('nope');
    }) as unknown as typeof document.execCommand;

    const { result } = renderHook(() => useClipboard());
    const ok = await result.current.copy('x');
    expect(ok).toBe(false);
  });
});
