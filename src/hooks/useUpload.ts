'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  compressImage,
  createPreviewUrl,
  loadUploadDefaults,
} from '@/lib/upload-helpers';
import { analyzeSubjectMask, createSubjectMask } from '@/lib/bg-removal';
import type {
  ContentSafetyResult,
  ImageRecord,
  UploadItem,
  UploadState,
} from '@/types';

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
  | { type: 'INCREMENT_ITEM_ATTEMPTS'; payload: string }
  | { type: 'SET_ITEM_BLOB'; payload: { id: string; blob: Blob } }
  | { type: 'SET_ITEM_MODERATION'; payload: { id: string; moderation: ContentSafetyResult } }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESET' }
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'INCREMENT_COMPLETED' }
  | { type: 'INCREMENT_ERROR' };

const initialState: UploadState = {
  items: [],
  globalOptions: {
    removeBg: false,
    moderate: false,
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
          moderate: state.globalOptions.moderate,
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
    case 'INCREMENT_ITEM_ATTEMPTS':
      return {
        ...state,
        items: state.items.map((item) => item.id === action.payload
          ? { ...item, attempts: (item.attempts ?? 0) + 1 }
          : item),
      };
    case 'SET_ITEM_BLOB':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, processedBlob: action.payload.blob } : i
        ),
      };
    case 'SET_ITEM_MODERATION':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, moderation: action.payload.moderation }
            : item
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
  const [selectedPreset, setSelectedPreset] = useState('');

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

  const selectUploadPreset = useCallback((name: string) => {
    setSelectedPreset(name);
  }, []);

  const startUpload = useCallback(async () => {
    const { items, globalOptions, isUploading } = stateRef.current;
    if (isUploading) return;

    const pending = items.filter((i) => i.status === 'pending' || i.status === 'error');
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

        // 3. Local AI moderation: derive a subject mask and reject images whose
        // opaque subject fills most of the canvas. This is conservative, private,
        // and catches tightly cropped explicit subjects without an external API.
        if (opts.moderate || globalOptions.moderate) {
          dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { id: item.id, status: 'moderating' } });
          const mask = await createSubjectMask(item.file);
          const moderation = await analyzeSubjectMask(mask);
          dispatch({ type: 'SET_ITEM_MODERATION', payload: { id: item.id, moderation } });
          if (!moderation.safe) {
            throw new Error('Upload blocked by local AI moderation');
          }
        }

        // 4. Upload with byte-level progress from XHR's upload stream.
        dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { id: item.id, status: 'uploading' } });
        dispatch({ type: 'INCREMENT_ITEM_ATTEMPTS', payload: item.id });
        const formData = new FormData();
        formData.append('file', blob, item.file.name);
        formData.append('folder', opts.folder || globalOptions.folder);
        formData.append('tags', opts.tags || globalOptions.tags);
        if (selectedPreset) formData.append('upload_preset', selectedPreset);
        formData.append('compressed', String(shouldCompress));
        formData.append('bgRemoved', String(shouldRemoveBg));
        if (latest?.moderation) {
          formData.append('moderated', 'true');
          formData.append('moderationScore', String(latest.moderation.score));
        }

        const payload = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const request = new (window as Window & {
            XMLHttpRequest: typeof XMLHttpRequest;
          }).XMLHttpRequest();
          request.open('POST', '/api/upload');
          request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              dispatch({
                type: 'UPDATE_ITEM_PROGRESS',
                payload: {
                  id: item.id,
                  progress: Math.round((event.loaded / event.total) * 100),
                },
              });
            }
          });
          request.addEventListener('load', () => {
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(request.responseText || '{}') as Record<string, unknown>;
            } catch {
              reject(new Error(`Upload failed (${request.status})`));
              return;
            }
            if (request.status >= 200 && request.status < 300) {
              resolve(parsed);
              return;
            }
            const errors = parsed.errors as Array<{ error?: string }> | undefined;
            reject(new Error(
              (typeof parsed.error === 'string' && parsed.error)
                || errors?.[0]?.error
                || `Upload failed (${request.status})`
            ));
          });
          request.addEventListener('error', () => reject(new Error('Network error during upload')));
          request.addEventListener('abort', () => reject(new Error('Upload canceled')));
          request.send(formData);
        });

        const result = (payload.images as ImageRecord[] | undefined)?.[0];
        if (!result) {
          const errors = payload.errors as Array<{ error?: string }> | undefined;
          throw new Error(errors?.[0]?.error || 'Upload failed');
        }

        dispatch({ type: 'SET_ITEM_RESULT', payload: { id: item.id, result } });
        dispatch({ type: 'INCREMENT_COMPLETED' });
        completed += 1;
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
  }, [selectedPreset]);

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
    selectedPreset,
    selectUploadPreset,
    startUpload,
    clearCompleted,
    reset,
  };
}
