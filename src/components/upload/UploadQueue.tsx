'use client';

import type { UploadItem as UploadItemType } from '@/types';
import { UploadItem as UploadItemRow } from './UploadItem';
import styles from './UploadQueue.module.css';

interface UploadQueueProps {
  items: UploadItemType[];
  onRemove: (id: string) => void;
}

export function UploadQueue({ items, onRemove }: UploadQueueProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.queue}>
      <div className={styles.header}>
        <h2 className={styles.title}>Upload Queue</h2>
        <span className={styles.count}>
          {items.length} file{items.length === 1 ? '' : 's'} in queue
        </span>
      </div>
      <div className={styles.list}>
        {items.map((item) => (
          <UploadItemRow key={item.id} item={item} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
