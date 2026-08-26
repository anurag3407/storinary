import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useUpload } from './useUpload';
import { MockXmlHttpRequest } from './mock-xml-http-request';
import type { ImageRecord } from '@/types';

// Mock the client-side helpers the hook depends on (hoisted to avoid vi.mock hoisting issues)
const {
  compressImageMock,
  createPreviewUrlMock,
  loadUploadDefaultsMock,
  createSubjectMaskMock,
  analyzeSubjectMaskMock,
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
    moderate: false,
  })),
  createSubjectMaskMock: vi.fn(async () => new Blob()),
  analyzeSubjectMaskMock: vi.fn(async () => ({ safe: true, score: 0.2, threshold: 0.82 })),
}));

vi.mock('@/lib/bg-removal', () => ({
  createSubjectMask: createSubjectMaskMock,
  analyzeSubjectMask: analyzeSubjectMaskMock,
  removeBg: vi.fn(async () => new Blob()),
}));

vi.mock('@/lib/upload-helpers', () => {
  return {
    compressImage: compressImageMock,
    createPreviewUrl: createPreviewUrlMock,
    loadUploadDefaults: loadUploadDefaultsMock,
  };
});

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
  aiModerated: false,
  aiModerationScore: null,
  compressed: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useUpload', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    MockXmlHttpRequest.behavior.mockReset();
    const defaultBehavior = (request: InstanceType<typeof MockXmlHttpRequest>) => {
      request.status = 200;
      request.responseText = JSON.stringify({ images: [UPLOADED_IMAGE] });
      request.loadHandler?.(new ProgressEvent('load'));
    };
    MockXmlHttpRequest.behavior.mockImplementation(defaultBehavior);
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'XMLHttpRequest', {
      configurable: true,
      writable: true,
      value: MockXmlHttpRequest,
    });
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
    MockXmlHttpRequest.instances = 0;
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
    expect(MockXmlHttpRequest.behavior).toHaveBeenCalledTimes(1);
  });

  it('runs background removal when the option is enabled', async () => {
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

    expect(createSubjectMaskMock).not.toHaveBeenCalled();
    expect(result.current.state.items[0].status).toBe('done');
  });

  it('runs local AI moderation and blocks high subject coverage', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: [UPLOADED_IMAGE], errors: [] }),
    });
    const { result } = renderHook(() => useUpload());
    act(() => result.current.addFiles([new File(['x'], 'a.png', { type: 'image/png' })]));
    act(() => result.current.updateGlobalOptions({ moderate: true }));
    analyzeSubjectMaskMock.mockResolvedValueOnce({ safe: false, score: 0.95, threshold: 0.82 });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(createSubjectMaskMock).toHaveBeenCalledWith(result.current.state.items[0].file);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.state.items[0].status).toBe('error');
    expect(result.current.state.items[0].error).toBe('Upload blocked by local AI moderation');
  });

  it('marks an item as errored when the upload fails', async () => {
    MockXmlHttpRequest.behavior.mockImplementationOnce(
      (request: InstanceType<typeof MockXmlHttpRequest>) => {
        request.status = 500;
        request.responseText = JSON.stringify({ error: 'boom' });
        request.loadHandler?.(new ProgressEvent('load'));
      }
    );

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

  it('tracks byte-level XHR progress and retries failed uploads', async () => {
    const { result } = renderHook(() => useUpload());
    act(() => result.current.addFiles([new File(['x'], 'a.png', { type: 'image/png' })]));

    MockXmlHttpRequest.behavior.mockClear();
    MockXmlHttpRequest.behavior.mockImplementationOnce(
      (request: InstanceType<typeof MockXmlHttpRequest>) => {
        request.triggerUploadProgress(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: 25,
            total: 100,
          })
        );
        request.status = 500;
        request.responseText = JSON.stringify({ error: 'network failed' });
        request.loadHandler?.(new ProgressEvent('load'));
      }
    );

    await act(async () => {
      await result.current.startUpload();
    });

    expect(result.current.state.items[0]).toMatchObject({
      status: 'error',
      error: 'network failed',
      attempts: 1,
    });

    MockXmlHttpRequest.behavior.mockImplementationOnce(
      (request: InstanceType<typeof MockXmlHttpRequest>) => {
        request.status = 200;
        request.responseText = JSON.stringify({ images: [UPLOADED_IMAGE] });
        request.loadHandler?.(new ProgressEvent('load'));
      }
    );

    await act(async () => {
      await result.current.startUpload();
    });

    expect(MockXmlHttpRequest.behavior).toHaveBeenCalledTimes(2);
    expect(result.current.state.items[0]).toMatchObject({
      status: 'done',
      attempts: 2,
      progress: 100,
    });
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
