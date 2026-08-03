import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeBackgroundMock = vi.fn();

vi.mock('@imgly/background-removal', () => ({
  removeBackground: removeBackgroundMock,
}));

import { removeBg } from './bg-removal';

describe('removeBg', () => {
  beforeEach(() => removeBackgroundMock.mockReset());

  it('returns the blob produced by the library', async () => {
    const pngBlob = new Blob(['png'], { type: 'image/png' });
    removeBackgroundMock.mockResolvedValue(pngBlob);

    const result = await removeBg(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(result).toBe(pngBlob);
  });

  it('passes a valid model and forwards progress', async () => {
    removeBackgroundMock.mockResolvedValue(new Blob());
    const onProgress = vi.fn();

    await removeBg('https://example.com/a.jpg', onProgress);

    expect(removeBackgroundMock).toHaveBeenCalledWith(
      'https://example.com/a.jpg',
      expect.objectContaining({ model: 'isnet' })
    );

    // Trigger the progress callback to verify forwarding
    const options = removeBackgroundMock.mock.calls[0][1];
    options.progress('fetch', 2, 10);
    expect(onProgress).toHaveBeenCalledWith({ key: 'fetch', current: 2, total: 10 });
  });
});
