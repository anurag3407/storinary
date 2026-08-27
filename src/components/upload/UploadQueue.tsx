'use client';

import { Button } from '@/components/ui/Button';
import type { UploadItem as UploadItemType } from '@/types';
import { UploadItem as UploadItemRow } from './UploadItem';
import styles from './UploadQueue.module.css';

interface UploadQueueProps {
  items: UploadItemType[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onUploadAll?: () => void;
  isUploading?: boolean;
}

export function UploadQueue({
  items,
  onRemove,
  onRetry,
  onUploadAll,
  isUploading = false,
}: UploadQueueProps) {
  if (items.length === 0) return null;

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className={styles.queue}>
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.title}>Upload Queue</h2>
          <span className={styles.count}>
            {items.length} file{items.length === 1 ? '' : 's'} in queue
          </span>
        </div>
        {pendingCount > 0 && onUploadAll && (
          <Button
            variant="primary"
            size="sm"
            icon="🚀"
            onClick={onUploadAll}
            loading={isUploading}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading…' : `Start Upload (${pendingCount})`}
          </Button>
        )}
      </div>
      <div className={styles.list}>
        {items.map((item) => (
          <UploadItemRow key={item.id} item={item} onRemove={onRemove} onRetry={onRetry} />
        ))}
      </div>
    </div>
  );
}
