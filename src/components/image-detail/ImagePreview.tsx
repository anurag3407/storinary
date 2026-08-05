'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ImageRecord } from '@/types';
import styles from './ImagePreview.module.css';

interface ImagePreviewProps {
  image: ImageRecord;
  transformedSrc?: string;
}

export function ImagePreview({ image, transformedSrc }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(false);

  return (
    <div className={styles.card}>
      <div
        className={`${styles.viewport} ${zoom ? styles.zoomed : ''}`}
        onClick={() => setZoom((z) => !z)}
        title={zoom ? 'Click to zoom out' : 'Click to zoom in'}
      >
        <div className={styles.checkerboard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={transformedSrc || image.publicUrl}
            alt={image.altText || image.originalName}
            className={styles.image}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== image.publicUrl) {
                target.src = image.publicUrl;
              }
            }}
          />
        </div>
      </div>

      <div className={styles.overlay}>
        <span className={styles.badge}>
          <Badge variant="info">
            {image.width} × {image.height}
          </Badge>
        </span>
        <span className={styles.badgeRight}>
          <Badge>{image.format.toUpperCase()}</Badge>
        </span>
      </div>

      <div className={styles.hint}>
        {transformedSrc ? 'Transformed preview' : 'Original'} · click to zoom
      </div>
    </div>
  );
}
