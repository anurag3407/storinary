import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useImages } from './useImages';
import type { ImagesListResponse } from '@/types';

const MOCK_IMAGE = {
  id: 'img-1',
  originalName: 'a.webp',
  storagePath: '2024/01/a-123.webp',
  publicUrl: 'https://cdn.example/2024/01/a-123.webp',
  width: 100,
  height: 100,
  fileSize: 1000,
  format: 'webp',
  mimeType: 'image/webp',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  compressed: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function makeListResponse(
  images = [MOCK_IMAGE],
  total = 1,
  page = 1
): ImagesListResponse {
  return {
    images,
    pagination: {
      page,
      limit: 20,
      total,
      totalPages: Math.max(1, Math.ceil(total / 20)),
    },
  };
}

describe('useImages', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads images on mount and exposes pagination', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse([MOCK_IMAGE], 25, 1),
    });

    const { result } = renderHook(() => useImages());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.images).toHaveLength(1);
    expect(result.current.pagination.total).toBe(25);
    expect(result.current.pagination.totalPages).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/images?')
    );
  });

  it('sets an error message when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useImages());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to load images');
  });

  it('supports selection toggling', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse([MOCK_IMAGE]),
    });

    const { result } = renderHook(() => useImages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleSelect('img-1'));
    expect(result.current.selectedIds.has('img-1')).toBe(true);

    act(() => result.current.toggleSelect('img-1'));
    expect(result.current.selectedIds.has('img-1')).toBe(false);
  });

  it('selectAll adds every loaded image', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        makeListResponse([
          MOCK_IMAGE,
          { ...MOCK_IMAGE, id: 'img-2' },
        ]),
    });

    const { result } = renderHook(() => useImages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(2);

    act(() => result.current.deselectAll());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('debounces search changes by 300ms', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse(),
    });

    const { result } = renderHook(() => useImages());
    // Initial load effect runs immediately
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.setFilters({ search: 'cat' }));
    await act(async () => {
      vi.advanceTimersByTime(299);
      await Promise.resolve();
    });

    const callsAfterFirst = fetchMock.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('search=cat');
  });

  it('setPage updates the page filter and reloads', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse(),
    });

    const { result } = renderHook(() => useImages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.filters.page).toBe(3));
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('page=3');
  });

  it('refresh reloads with the current filters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse(),
    });

    const { result } = renderHook(() => useImages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = fetchMock.mock.calls.length;
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it('deleteImages removes selection and reloads', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeListResponse([MOCK_IMAGE]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, deleted: 1, errors: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeListResponse([]),
      });

    const { result } = renderHook(() => useImages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleSelect('img-1'));
    await act(async () => {
      await result.current.deleteImages(['img-1']);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/images'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.images).toHaveLength(0);
  });
});
