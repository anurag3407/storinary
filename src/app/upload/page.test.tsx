import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import UploadPage from './page';

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() } }),
}));

vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

const useUploadMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useUpload', () => ({
  useUpload: useUploadMock,
}));

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUploadMock.mockReturnValue({
      state: {
        items: [],
        globalOptions: {
          folder: '/',
          tags: '',
          compress: false,
          quality: 85,
          maxWidth: 2048,
          removeBg: false,
          moderate: false,
        },
        isUploading: false,
      },
      addFiles: vi.fn(),
      removeFile: vi.fn(),
      updateGlobalOptions: vi.fn(),
      startUpload: vi.fn(),
      reset: vi.fn(),
      selectedPreset: null,
      selectUploadPreset: vi.fn(),
    });
  });

  it('uses a single upload state instance so presets reach the request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ presets: [] }),
    });

    render(<UploadPage />);

    // Calling useUpload twice split state into two instances and dropped the
    // selected upload preset; guard against that regression.
    expect(useUploadMock).toHaveBeenCalledTimes(1);
  });

  it('renders SaaS quota banner showing 100 MB free allocation', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/quota')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            quota: {
              usedFormatted: '25 MB',
              limitFormatted: '100 MB',
              remainingFormatted: '75 MB',
              percentage: 25,
              isExceeded: false,
              isNearLimit: false,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ presets: [] }),
      });
    });

    render(<UploadPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Quota')).toBeInTheDocument();
      expect(screen.getByText('25 MB')).toBeInTheDocument();
      expect(screen.getByText(/75 MB available/i)).toBeInTheDocument();
    });
  });

  it('renders quota warning when account is near limit', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/quota')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            quota: {
              usedFormatted: '88 MB',
              limitFormatted: '100 MB',
              remainingFormatted: '12 MB',
              percentage: 88,
              isExceeded: false,
              isNearLimit: true,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ presets: [] }),
      });
    });

    render(<UploadPage />);

    await waitFor(() => {
      expect(screen.getByText('Storage Warning')).toBeInTheDocument();
    });
  });

  it('renders quota exceeded warning when 100 MB is reached', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/quota')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            quota: {
              usedFormatted: '100 MB',
              limitFormatted: '100 MB',
              remainingFormatted: '0 B',
              percentage: 100,
              isExceeded: true,
              isNearLimit: true,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ presets: [] }),
      });
    });

    render(<UploadPage />);

    await waitFor(() => {
      expect(screen.getByText('Quota Exceeded')).toBeInTheDocument();
      expect(screen.getByText(/100 MB free quota limit reached/i)).toBeInTheDocument();
    });
  });
});
