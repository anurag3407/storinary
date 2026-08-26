// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/ToastProvider';
import VideosPage from './page';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('hls.js', () => ({
  default: class {
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
  },
}));

vi.mock('dashjs', () => ({
  MediaPlayer: () => ({
    create: () => ({
      initialize: vi.fn(),
      destroy: vi.fn(),
    }),
  }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function video(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    originalName: 'demo.mp4',
    storagePath: 'videos/demo.mp4',
    publicUrl: 'https://cdn.example/demo.mp4',
    mimeType: 'video/mp4',
    posterPath: null,
    format: 'mp4',
    width: 1280,
    height: 720,
    duration: 30,
    fileSize: 1000,
    folder: '/',
    tags: '',
    altText: '',
    status: 'ready',
    metadata: { campaign: 'spring' },
    renditions: [],
    hlsPackages: [],
    dashPackages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Videos dashboard AI and adaptive streaming', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/collections') return jsonResponse({ collections: [] });
      if (url === '/api/metadata-fields') {
        return jsonResponse({
          fields: [{
            id: 'field-campaign', externalId: 'campaign', label: 'Campaign',
            type: 'enum', required: false, allowedValues: ['spring', 'fall'], active: true,
          }],
        });
      }
      if (url.startsWith('/api/videos?page=')) {
        return jsonResponse({
          videos: [video()],
          pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
        });
      }
      if (url === '/api/videos/video-1') {
        return jsonResponse({ ...video(), metadata: { campaign: 'fall' } });
      }
      if (url === '/api/videos/video-1/hls?variants=360p,720p' || url === '/api/videos/video-1/dash?variants=360p,720p') {
        return jsonResponse({ success: true }, false);
      }
      if (url === '/api/videos/video-1/ai') return jsonResponse({ success: true }, false);
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  it('offers adaptive package generation and reloads the library', async () => {
    const user = userEvent.setup();
    render(<VideosPage />, { wrapper: ToastProvider });

    await screen.findByText('demo.mp4');
    await user.click(screen.getByRole('button', { name: 'Create ABR' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/videos/video-1/hls?variants=360p,720p', { method: 'POST' }));
    await user.click(screen.getByRole('button', { name: 'Create DASH' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/videos/video-1/dash?variants=360p,720p', { method: 'POST' });
      expect(screen.getByRole('button', { name: 'Create ABR' })).toBeInTheDocument();
    });
  });

  it('requests poster-based AI insights for a video', async () => {
    const user = userEvent.setup();
    render(<VideosPage />, { wrapper: ToastProvider });

    await screen.findByText('demo.mp4');
    await user.click(screen.getByRole('button', { name: 'Analyze AI' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/videos/video-1/ai', { method: 'POST' })
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Analyze AI' })).toBeEnabled()
    );
  });

  it('filters videos by structured metadata and displays values', async () => {
    const user = userEvent.setup();
    render(<VideosPage />, { wrapper: ToastProvider });

    expect(await screen.findByText('campaign: spring')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter by Campaign'), 'spring');

    await waitFor(() => {
      const listUrl = [...fetchMock.mock.calls].reverse()
        .map(([input]) => String(input))
        .find((url) => url.includes('/api/videos?'));
      expect(listUrl).toContain('metadata=campaign%3Dspring');
    });
  });

  it('saves structured metadata directly on a video', async () => {
    const user = userEvent.setup();
    render(<VideosPage />, { wrapper: ToastProvider });

    await screen.findByText('campaign: spring');
    await user.selectOptions(screen.getByLabelText('Campaign'), 'fall');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/videos/video-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { campaign: 'fall' } }),
      });
      expect(screen.getByText('campaign: fall')).toBeInTheDocument();
    });
    expect(await screen.findByText('Metadata saved')).toBeInTheDocument();
  });

  it('debounces repeated search input before loading videos', async () => {
    const user = userEvent.setup({ delay: null });
    render(<VideosPage />, { wrapper: ToastProvider });

    await screen.findByText('demo.mp4');
    const initialCalls = fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/videos?')).length;

    await user.type(screen.getByLabelText('Search videos'), 'abc');

    expect(screen.getByLabelText('Search videos')).toHaveValue('abc');
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/videos?'));
      expect(calls.length).toBeGreaterThan(initialCalls);
      expect(String(calls.at(-1)?.[0])).toContain('search=abc');
    }, { timeout: 1000 });

    const searchCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('search='));
    expect(searchCalls.length).toBe(1);
  });
});
