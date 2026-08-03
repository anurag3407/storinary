'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { nanoid } from 'nanoid';
import {
  compressImage,
  createPreviewUrl,
  loadUploadDefaults,
} from '@/lib/upload-helpers';
import type { ImageRecord, UploadItem, UploadState } from '@/types';

// ════════════════════════════════════════════════════════════
// REDUCER ACTIONS
// ════════════════════════════════════════════════════════════

type UploadAction =
  | { type: 'ADD_FILES'; payload: File[] }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_GLOBAL_OPTIONS'; payload: Partial<UploadState['globalOptions']> }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { id: string; status: UploadItem['status'] } }
  | { type: 'UPDATE_ITEM_PROGRESS'; payload: { id: string; progress: number } }
  | { type: 'SET_ITEM_RESULT'; payload: { id: string; result: ImageRecord } }
  | { type: 'SET_ITEM_ERROR'; payload: { id: string; error: string } }
  | { type: 'SET_ITEM_BLOB'; payload: { id: string; blob: Blob } }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESET' }
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'INCREMENT_COMPLETED' }
  | { type: 'INCREMENT_ERROR' };

const initialState: UploadState = {
  items: [],
  globalOptions: {
    removeBg: false,
    compress: true,
    quality: 80,
    maxWidth: 2048,
    folder: '/',
    tags: '',
  },
  isUploading: false,
  completedCount: 0,
  errorCount: 0,
};

function reducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'ADD_FILES': {
      const items: UploadItem[] = action.payload.map((file) => ({
        id: nanoid(10),
        file,
        previewUrl: createPreviewUrl(file),
        status: 'pending',
        progress: 0,
        options: {
          removeBg: state.globalOptions.removeBg,
          compress: state.globalOptions.compress,
          folder: state.globalOptions.folder,
          tags: state.globalOptions.tags,
        },
      }));
      return { ...state, items: [...state.items, ...items] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case 'UPDATE_GLOBAL_OPTIONS':
      return { ...state, globalOptions: { ...state.globalOptions, ...action.payload } };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, status: action.payload.status } : i
        ),
      };
    case 'UPDATE_ITEM_PROGRESS':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, progress: action.payload.progress } : i
        ),
      };
    case 'SET_ITEM_RESULT':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, result: action.payload.result, status: 'done', progress: 100 }
            : i
        ),
      };
    case 'SET_ITEM_ERROR':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, error: action.payload.error, status: 'error' } : i
        ),
      };
    case 'SET_ITEM_BLOB':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, processedBlob: action.payload.blob } : i
        ),
      };
    case 'CLEAR_COMPLETED':
      return {
        ...state,
        items: state.items.filter((i) => i.status !== 'done' && i.status !== 'error'),
      };
    case 'RESET':
      return initialState;
    case 'SET_UPLOADING':
      return { ...state, isUploading: action.payload };
    case 'INCREMENT_COMPLETED':
      return { ...state, completedCount: state.completedCount + 1 };
    case 'INCREMENT_ERROR':
      return { ...state, errorCount: state.errorCount + 1 };
    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════
// HOOK
// ════════════════════════════════════════════════════════════

export function useUpload() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load persisted default upload options (saved from the Settings page)
  useEffect(() => {
    const saved = loadUploadDefaults();
    dispatch({ type: 'UPDATE_GLOBAL_OPTIONS', payload: saved });
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    dispatch({ type: 'ADD_FILES', payload: list });
  }, []);

  const removeFile = useCallback((id: string) => {
    const item = stateRef.current.items.find((i) => i.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  }, []);

  const updateGlobalOptions = useCallback(
    (options: Partial<UploadState['globalOptions']>) => {
      dispatch({ type: 'UPDATE_GLOBAL_OPTIONS', payload: options });
    },
    []
  );

  const startUpload = useCallback(async () => {
    const { items, globalOptions, isUploading } = stateRef.current;
    if (isUploading) return;

    const pending = items.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;

    dispatch({ type: 'SET_UPLOADING', payload: true });

    let completed = 0;
    let failed = 0;

    // Upload files SEQUENTIALLY (one at a time)
    for (const item of pending) {
      const latest = stateRef.current.items.find((i) => i.id === item.id);
      const opts = latest?.options ?? item.options;

      try {
        let blob: Blob = item.file;
        const shouldCompress = opts.compress || globalOptions.compress;
        const shouldRemoveBg = opts.removeBg || globalOptions.removeBg;

        // 1. Client-side compression → WebP
        if (shouldCompress) {
          dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { id: item.id, status: 'compressing' } });
          blob = await compressImage(
            item.file,
            globalOptions.maxWidth,
            globalOptions.quality / 100
          );
          dispatch({ type: 'SET_ITEM_BLOB', payload: { id: item.id, blob } });
        }

        // 2. Client-side background removal (WASM, in browser)
        if (shouldRemoveBg) {
          dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { id: item.id, status: 'removing-bg' } });
          const { removeBg: removeBgFn } = await import('@/lib/bg-removal');
          blob = await removeBgFn(blob);
          dispatch({ type: 'SET_ITEM_BLOB', payload: { id: item.id, blob } });
        }

        // 3. Upload with simulated progress (fetch has no upload progress API)
        dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { id: item.id, status: 'uploading' } });

        let progress = 5;
        const timer = window.setInterval(() => {
          progress = Math.min(90, progress + Math.random() * 12);
          dispatch({ type: 'UPDATE_ITEM_PROGRESS', payload: { id: item.id, progress } });
        }, 200);

        const formData = new FormData();
        formData.append('file', blob, item.file.name);
        formData.append('folder', opts.folder || globalOptions.folder);
        formData.append('tags', opts.tags || globalOptions.tags);
        formData.append('compressed', String(shouldCompress));
        formData.append('bgRemoved', String(shouldRemoveBg));

        let response: Response;
        try {
          response = await fetch('/api/upload', { method: 'POST', body: formData });
        } finally {
          window.clearInterval(timer);
        }

        if (response.ok) {
          const data = await response.json();
          const result = data?.images?.[0] as ImageRecord | undefined;
          if (result) {
            dispatch({ type: 'SET_ITEM_RESULT', payload: { id: item.id, result } });
            dispatch({ type: 'INCREMENT_COMPLETED' });
            completed += 1;
          } else {
            throw new Error(data?.errors?.[0]?.error || 'Upload failed');
          }
        } else {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Upload failed');
        }
      } catch (error) {
        dispatch({
          type: 'SET_ITEM_ERROR',
          payload: {
            id: item.id,
            error: error instanceof Error ? error.message : 'Upload failed',
          },
        });
        dispatch({ type: 'INCREMENT_ERROR' });
        failed += 1;
      }
    }

    dispatch({ type: 'SET_UPLOADING', payload: false });
    return { completed, failed };
  }, []);

  const clearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' });
  }, []);

  const reset = useCallback(() => {
    stateRef.current.items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    addFiles,
    removeFile,
    updateGlobalOptions,
    startUpload,
    clearCompleted,
    reset,
  };
}
