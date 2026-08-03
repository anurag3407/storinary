import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Stable env vars for modules that read them at import time
process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB = '10';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_BUCKET_NAME = 'storinary';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Auto-cleanup rendered DOM between tests
afterEach(() => {
  cleanup();
});

// jsdom lacks object URL helpers used by upload hooks/components
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'blob:mock-object-url'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// This jsdom environment does not provide a functional localStorage;
// supply an in-memory implementation so upload defaults can be tested.
if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

// jsdom lacks DataTransfer, which useUpload tests need to build a FileList
if (typeof window !== 'undefined' && typeof window.DataTransfer === 'undefined') {
  class MockDataTransfer {
    files: File[] = [];
    items = {
      add: (file: File) => {
        this.files.push(file);
      },
      length: 0,
    };
  }

  Object.defineProperty(window, 'DataTransfer', {
    writable: true,
    value: MockDataTransfer,
  });
}

// jsdom lacks some browser APIs used by components/hooks
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (!window.scrollTo) {
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    });
  }
}
