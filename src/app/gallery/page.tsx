'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GalleryToolbar } from '@/components/gallery/GalleryToolbar';
import { FolderManager } from '@/components/gallery/FolderManager';
import { ImageGrid } from '@/components/gallery/ImageGrid';
import { Pagination } from '@/components/gallery/Pagination';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useClipboard } from '@/hooks/useClipboard';
import { useImages } from '@/hooks/useImages';
import { useToast } from '@/hooks/useToast';
import styles from './gallery.module.css';
import type { CollectionRecord } from '@/lib/collections';
import type { FolderRecord } from '@/lib/folders';
import type { MetadataFieldRecord } from '@/lib/structured-metadata';

export default function GalleryPage() {
  const {
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
  } = useImages();
  const { toast } = useToast();
  const { copy } = useClipboard();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [managedFolders, setManagedFolders] = useState<FolderRecord[]>([]);
  const [metadataFields, setMetadataFields] = useState<MetadataFieldRecord[]>([]);
  const [isManagingFolders, setIsManagingFolders] = useState(false);

  const loadCollections = useCallback(async () => {
    const response = await fetch('/api/collections', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setCollections(data.collections ?? []);
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const loadFolders = useCallback(async () => {
    try {
      const response = await fetch('/api/folders', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setManagedFolders(data.folders ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const loadMetadataFields = useCallback(async () => {
    try {
      const response = await fetch('/api/metadata-fields', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setMetadataFields((data.fields ?? []).filter(
        (field: MetadataFieldRecord) => field.type === 'enum' && field.active
      ));
    } catch {}
  }, []);

  useEffect(() => {
    void loadMetadataFields();
  }, [loadMetadataFields]);

  const selectedCount = selectedIds.size;

  // Keyboard shortcuts: Ctrl/Cmd+A select all, Delete → confirm delete, Escape → deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (images.length > 0) {
          selectAll();
          toast.info(`Selected ${images.length} image(s)`);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCount > 0) {
          e.preventDefault();
          setConfirmDelete(true);
        }
      } else if (e.key === 'Escape') {
        deselectAll();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, selectedCount, selectAll, deselectAll, toast]);

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const count = selectedIds.size;
      await deleteImages(Array.from(selectedIds));
      toast.success(`Deleted ${count} image(s)`);
      setConfirmDelete(false);
    } catch {
      toast.error('Failed to delete images');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await deleteImages([id]);
      toast.success('Image deleted');
    } catch {
      toast.error('Failed to delete image');
    }
  };

  const handleCopyUrl = async (url: string) => {
    await copy(url);
    toast.success('URL copied!');
  };

  const handleBulkCopy = async () => {
    const selected = images.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const text = selected.map((i) => i.publicUrl).join('\n');
    await copy(text);
    toast.success(`${selected.length} URL(s) copied!`);
  };

  const handleBulkDownload = async () => {
    if (selectedCount === 0) return;
    setIsArchiving(true);
    try {
      const response = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Archive failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'storinary.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Archive downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download archive');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', imageIds: Array.from(selectedIds) }),
      });
      if (!response.ok) throw new Error();
      toast.success(`Added ${selectedCount} image(s) to collection`);
      await loadCollections();
    } catch {
      toast.error('Could not update collection');
    }
  };

  const folders = Array.from(
    new Set([...images.map((image) => image.folder), ...managedFolders.map((folder) => folder.path)])
  ).sort();

  const renameFolder = async (from: string, to: string) => {
    setIsManagingFolders(true);
    try {
      const response = await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Rename failed' }));
        throw new Error(body.error || 'Rename failed');
      }
      toast.success('Folder renamed');
      setFilters({ folder: to, page: 1 });
      await Promise.all([loadFolders(), refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not rename folder');
    } finally {
      setIsManagingFolders(false);
    }
  };

  const deleteFolder = async (path: string) => {
    setIsManagingFolders(true);
    try {
      const response = await fetch(`/api/folders?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(body.error || 'Delete failed');
      }
      toast.success('Folder deleted');
      if (filters.folder === path) setFilters({ folder: undefined, page: 1 });
      await loadFolders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete folder');
    } finally {
      setIsManagingFolders(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header
        title="Gallery"
        description="Search, filter, and manage your image library."
      />

      <GalleryToolbar
        filters={filters}
        setFilters={setFilters}
        selectedCount={selectedCount}
        totalCount={pagination.total}
        folders={folders}
        metadataFields={metadataFields}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onBulkDelete={() => setConfirmDelete(true)}
        onBulkCopy={handleBulkCopy}
        onBulkDownload={handleBulkDownload}
        onAddToCollection={(id) => void handleAddToCollection(id)}
        isArchiving={isArchiving}
        collections={collections}
      />

      <FolderManager
        folders={managedFolders}
        isBusy={isManagingFolders}
        onSelectFolder={(path) => setFilters({ folder: path || undefined, page: 1 })}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
      />

      {isLoading && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon="⚠️"
          title="Something went wrong"
          description={error}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try Again
            </Button>
          }
        />
      )}

      {!isLoading && !error && images.length === 0 && (
        <EmptyState
          icon="🖼️"
          title="No images yet"
          description="Upload some images to get started — they'll appear here with copy-ready CDN links."
          action={
            <Link href="/upload">
              <Button icon="⬆️">Upload Images</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !error && images.length > 0 && (
        <>
          <ImageGrid
            images={images}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDelete={handleDeleteOne}
            onCopyUrl={handleCopyUrl}
          />
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete images?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleBulkDelete} loading={deleting}>
              Delete {selectedCount} image(s)
            </Button>
          </>
        }
      >
        <p>
          This will permanently delete <strong>{selectedCount} image(s)</strong>{' '}
          from both the gallery and Supabase Storage. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
