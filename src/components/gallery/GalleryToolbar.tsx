'use client';

import { Button } from '@/components/ui/Button';
import type { ImagesListParams } from '@/types';
import styles from './GalleryToolbar.module.css';

interface GalleryToolbarProps {
  filters: ImagesListParams;
  setFilters: (filters: Partial<ImagesListParams>) => void;
  selectedCount: number;
  totalCount: number;
  folders: string[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkCopy: () => void;
}

export function GalleryToolbar({
  filters,
  setFilters,
  selectedCount,
  totalCount,
  folders,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkCopy,
}: GalleryToolbarProps) {
  const start = totalCount === 0 ? 0 : (filters.page - 1) * filters.limit + 1;
  const end = Math.min(filters.page * filters.limit, totalCount);
  const allSelected =
    totalCount > 0 && selectedCount === Math.min(totalCount, filters.limit);

  return (
    <div className={styles.toolbar}>
      <div className={styles.controls}>
        <input
          className={`nb-input ${styles.search}`}
          type="text"
          placeholder="Search images..."
          value={filters.search || ''}
          onChange={(e) => setFilters({ search: e.target.value })}
        />

        <select
          className="nb-select"
          value={filters.folder || ''}
          onChange={(e) => setFilters({ folder: e.target.value || undefined })}
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f === '/' ? 'Root (/)' : f}
            </option>
          ))}
        </select>

        <select
          className="nb-select"
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value as ImagesListParams['sort'] })}
        >
          <option value="createdAt">Date</option>
          <option value="fileSize">Size</option>
          <option value="originalName">Name</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          icon={filters.order === 'desc' ? '↓' : '↑'}
          onClick={() => setFilters({ order: filters.order === 'desc' ? 'asc' : 'desc' })}
        >
          {filters.order === 'desc' ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      <div className={styles.right}>
        <label className="nb-checkbox">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => (e.target.checked ? onSelectAll() : onDeselectAll())}
          />
          Select All
        </label>

        {selectedCount > 0 && (
          <>
            <span className={styles.selectedInfo}>{selectedCount} selected</span>
            <Button variant="secondary" size="sm" icon="📋" onClick={onBulkCopy}>
              Copy URLs
            </Button>
            <Button variant="danger" size="sm" icon="🗑️" onClick={onBulkDelete}>
              Delete Selected
            </Button>
          </>
        )}

        <span className={styles.showing}>
          Showing {start}-{end} of {totalCount}
        </span>
      </div>
    </div>
  );
}
