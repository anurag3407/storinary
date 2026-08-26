'use client';

import { Button } from '@/components/ui/Button';
import type { MetadataFieldRecord } from '@/lib/structured-metadata';
import type { ImagesListParams } from '@/types';
import styles from './GalleryToolbar.module.css';

interface GalleryToolbarProps {
  filters: ImagesListParams;
  setFilters: (filters: Partial<ImagesListParams>) => void;
  selectedCount: number;
  totalCount: number;
  folders: string[];
  metadataFields?: MetadataFieldRecord[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkCopy: () => void;
  onBulkDownload: () => void;
  onAddToCollection?: (collectionId: string) => void;
  isArchiving?: boolean;
  collections?: Array<{ id: string; name: string }>;
}

export function GalleryToolbar({
  filters,
  setFilters,
  selectedCount,
  totalCount,
  folders,
  metadataFields = [],
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkCopy,
  onBulkDownload,
  onAddToCollection,
  isArchiving = false,
  collections = [],
}: GalleryToolbarProps) {
  const metadataFilters = new URLSearchParams(filters.metadata ?? '');

  const setMetadataFilter = (externalId: string, value: string) => {
    const next = new URLSearchParams(filters.metadata ?? '');
    if (value) next.set(externalId, value);
    else next.delete(externalId);
    setFilters({
      metadata: next.toString() || undefined,
      page: 1,
    });
  };
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

        {metadataFields?.map((field) => (
          <select
            key={field.id}
            aria-label={`Filter by ${field.label}`}
            className="nb-select"
            value={metadataFilters.get(field.externalId) ?? ''}
            onChange={(event) => setMetadataFilter(field.externalId, event.target.value)}
          >
            <option value={`${field.label}: all`}>{field.label}</option>
            {field.allowedValues.map((option) => (
              <option key={option} value={option}>{`${field.label}: ${option}`}</option>
            ))}
          </select>
        ))}

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
            <Button variant="secondary" size="sm" icon="📦" loading={isArchiving} onClick={onBulkDownload}>
              Download ZIP
            </Button>
            {collections.length > 0 && (
              <select
                aria-label="Add selected images to collection"
                className="nb-select"
                defaultValue=""
                onChange={(event) => {
                  const collectionId = event.target.value;
                  event.currentTarget.value = '';
                  if (collectionId) onAddToCollection?.(collectionId);
                }}
              >
                <option value="">Add to collection…</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>{collection.name}</option>
                ))}
              </select>
            )}
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
