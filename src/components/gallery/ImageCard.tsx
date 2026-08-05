'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatBytes, formatRelativeTime } from '@/lib/upload-helpers';
import { generateServeUrl } from '@/lib/utils';
import type { ImageRecord } from '@/types';
import styles from './ImageCard.module.css';

interface ImageCardProps {
  image: ImageRecord;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
}

export function ImageCard({
  image,
  isSelected,
  onToggleSelect,
  onDelete,
  onCopyUrl,
}: ImageCardProps) {
  const router = useRouter();

  // Serve a downscaled, optimized thumbnail instead of the full original, with fallback to publicUrl
  const thumbSrc = generateServeUrl(image.storagePath, { w: 400, q: 70 });
  const [imgSrc, setImgSrc] = useState(thumbSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(thumbSrc);
    setHasError(false);
  }, [thumbSrc]);

  const handleImageError = () => {
    if (!hasError && imgSrc !== image.publicUrl) {
      setHasError(true);
      setImgSrc(image.publicUrl);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${image.originalName}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={() => router.push(`/images/${image.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/images/${image.id}`);
      }}
    >
      <div className={styles.imageWrap} onClick={(e) => e.stopPropagation()}>
        <img
          src={imgSrc}
          alt={image.altText || image.originalName}
          loading="lazy"
          width={400}
          className={styles.image}
          onError={handleImageError}
        />
        <label
          className={`nb-checkbox ${styles.checkbox}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select ${image.originalName}`}
          />
        </label>
        <span className={styles.formatBadge}>
          <Badge>{image.format.toUpperCase()}</Badge>
        </span>
      </div>

      <div className={styles.info}>
        <span className={styles.filename} title={image.originalName}>
          {image.originalName}
        </span>
        <div className={styles.metaRow}>
          <span>{formatBytes(image.fileSize)}</span>
          <span>{formatRelativeTime(image.createdAt)}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onCopyUrl();
          }}
        >
          📋 Copy
        </button>
        <Link
          href={`/images/${image.id}`}
          className={styles.actionBtn}
          onClick={(e) => e.stopPropagation()}
        >
          🔗 View
        </Link>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
