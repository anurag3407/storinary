'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ImageRecord,
  ImagesListParams,
  ImagesListResponse,
} from '@/types';

const DEFAULT_FILTERS: ImagesListParams = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

export function useImages() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [pagination, setPagination] = useState<ImagesListResponse['pagination']>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFiltersState] = useState<ImagesListParams>(DEFAULT_FILTERS);

  const filtersRef = useRef(filters);
  const lastSearchRef = useRef<string | undefined>(undefined);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const load = useCallback(async (f: ImagesListParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(f.page));
      params.set('limit', String(f.limit));
      params.set('sort', f.sort);
      params.set('order', f.order);
      if (f.search) params.set('search', f.search);
      if (f.folder) params.set('folder', f.folder);

      const res = await fetch(`/api/images?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load images');
      const data: ImagesListResponse = await res.json();
      setImages(data.images);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch whenever filters change; debounce search input by 300ms
  useEffect(() => {
    const searchChanged = filters.search !== lastSearchRef.current;
    lastSearchRef.current = filters.search;

    if (searchChanged) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void load({ ...filters, page: 1 });
      }, 300);
    } else {
      void load(filters);
    }

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filters, load]);

  const setFilters = useCallback((f: Partial<ImagesListParams>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const refresh = useCallback(() => {
    void load(filtersRef.current);
  }, [load]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      images.forEach((i) => next.add(i.id));
      return next;
    });
  }, [images]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteImages = useCallback(
    async (ids: string[]) => {
      const res = await fetch('/api/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Delete failed');
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      await load(filtersRef.current);
    },
    [load]
  );

  return {
    images,
    pagination,
    isLoading,
    error,
    selectedIds,
    filters,
    setFilters,
    setPage,
    toggleSelect,
    selectAll,
    deselectAll,
    refresh,
    deleteImages,
  };
}
