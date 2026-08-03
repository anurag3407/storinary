'use client';

import type { ImageRecord } from '@/types';
import { ImageCard } from './ImageCard';
import styles from './ImageGrid.module.css';

interface ImageGridProps {
  images: ImageRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyUrl: (url: string) => void;
}

export function ImageGrid({
  images,
  selectedIds,
  onToggleSelect,
  onDelete,
  onCopyUrl,
}: ImageGridProps) {
  return (
    <div className={styles.grid}>
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          isSelected={selectedIds.has(image.id)}
          onToggleSelect={() => onToggleSelect(image.id)}
          onDelete={() => onDelete(image.id)}
          onCopyUrl={() => onCopyUrl(image.publicUrl)}
        />
      ))}
    </div>
  );
}
