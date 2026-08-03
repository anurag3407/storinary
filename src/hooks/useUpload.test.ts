import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUpload } from './useUpload';
import type { ImageRecord } from '@/types';

// Mock the client-side helpers the hook depends on (hoisted to avoid vi.mock hoisting issues)
const {
  compressImageMock,
  createPreviewUrlMock,
  loadUploadDefaultsMock,
} = vi.hoisted(() => ({
  compressImageMock: vi.fn(async (file: File) => file),
  createPreviewUrlMock: vi.fn(() => 'blob:preview'),
  loadUploadDefaultsMock: vi.fn(() => ({
    compress: true,
    quality: 80,
    maxWidth: 2048,
    removeBg: false,
    folder: '/',
    tags: '',
  })),
}));

vi.mock('@/lib/upload-helpers', () => ({
  compressImage: compressImageMock,
  createPreviewUrl: createPreviewUrlMock,
  loadUploadDefaults: loadUploadDefaultsMock,
}));

const UPLOADED_IMAGE: ImageRecord = {
  id: 'img-new',
  originalName: 'pic.png',
  storagePath: '2024/01/pic-abc12345.png',
  publicUrl: 'https://cdn.example/2024/01/pic-abc12345.png',
  width: 640,
  height: 480,
  fileSize: 2048,
  format: 'png',
  mimeType: 'image/png',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  compressed: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useUpload', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads persisted defaults on mount', async () => {
    const { result } = renderHook(() => useUpload());
    await waitFor(() => expect(loadUploadDefaultsMock).toHaveBeenCalled());
    expect(result.current.state.globalOptions.quality).toBe(80);
  });

  it('addFiles appends items with preview URLs', () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    act(() => result.current.addFiles([file]));

    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].file).toBe(file);
    expect(result.current.state.items[0].previewUrl).toBe('blob:preview');
    expect(result.current.state.items[0].status).toBe('pending');
  });

  it('addFiles accepts a FileList', () => {
    const { result } = renderHook(() => useUpload());
    const file1 = new File(['x'], 'a.png', { type: 'image/png' });
    const file2 = new File(['y'], 'b.png', { type: 'image/png' });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file1);
    dataTransfer.items.add(file2);

    act(() => result.current.addFiles(dataTransfer.files));
    expect(result.current.state.items).toHaveLength(2);
  });

  it('removeFile drops an item from the queue', () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    act(() => result.current.addFiles([file]));
    const id = result.current.state.items[0].id;

    act(() => result.current.removeFile(id));
    expect(result.current.state.items).toHaveLength(0);
  });

  it('updateGlobalOptions merges partial options', () => {
    const { result } = renderHook(() => useUpload());
    act(() => result.current.updateGlobalOptions({ quality: 60, removeBg: true }));
    expect(result.current.state.globalOptions.quality).toBe(60);
    expect(result.current.state.globalOptions.removeBg).toBe(true);
  });

  it('startUpload uploads pending files and marks them done', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: [UPLOADED_IMAGE], errors: [] }),
    });

    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => result.current.addFiles([file]));

    let outcome: { completed: number; failed: number } | undefined;
    await act(async () => {
      outcome = await result.current.startUpload();
    });

    expect(outcome).toEqual({ completed: 1, failed: 0 });
    expect(result.current.state.items[0].status).toBe('done');
    expect(result.current.state.items[0].result?.id).toBe('img-new');
    expect(compressImageMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/upload',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('runs background removal when the option is enabled', async () => {
    const removeBgMock = vi.fn(async () => new Blob());
    const bgModule = { removeBg: removeBgMock };

    vi.doMock('@/lib/bg-removal', () => bgModule);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: [UPLOADED_IMAGE], errors: [] }),
    });

    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => result.current.addFiles([file]));
    act(() => result.current.updateGlobalOptions({ removeBg: true }));

    await act(async () => {
      await result.current.startUpload();
    });

    expect(removeBgMock).toHaveBeenCalled();
    expect(result.current.state.items[0].status).toBe('done');
  });

  it('marks an item as errored when the upload fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    });

    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => result.current.addFiles([file]));

    let outcome: { completed: number; failed: number } | undefined;
    await act(async () => {
      outcome = await result.current.startUpload();
    });

    expect(outcome).toEqual({ completed: 0, failed: 1 });
    expect(result.current.state.items[0].status).toBe('error');
    expect(result.current.state.items[0].error).toBe('boom');
  });

  it('does nothing when no pending files exist', async () => {
    const { result } = renderHook(() => useUpload());
    let outcome: { completed: number; failed: number } | undefined;
    await act(async () => {
      outcome = await result.current.startUpload();
    });
    expect(outcome).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearCompleted removes finished items but keeps pending ones', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: [UPLOADED_IMAGE], errors: [] }),
    });

    const { result } = renderHook(() => useUpload());
    const doneFile = new File(['x'], 'done.png', { type: 'image/png' });
    act(() => result.current.addFiles([doneFile]));

    // Complete the first file, then add a new pending one
    await act(async () => {
      await result.current.startUpload();
    });
    const pendingFile = new File(['y'], 'pending.png', { type: 'image/png' });
    act(() => result.current.addFiles([pendingFile]));

    expect(result.current.state.items[0].status).toBe('done');
    expect(result.current.state.items[1].status).toBe('pending');

    act(() => result.current.clearCompleted());
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].file.name).toBe('pending.png');
  });

  it('reset clears the queue and options', () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    act(() => result.current.addFiles([file]));
    act(() => result.current.updateGlobalOptions({ quality: 40 }));

    act(() => result.current.reset());
    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.state.globalOptions.quality).toBe(80);
  });
});
