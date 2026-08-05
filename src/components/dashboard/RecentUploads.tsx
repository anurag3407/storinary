'use client';

import Link from 'next/link';
import { formatBytes, formatRelativeTime } from '@/lib/upload-helpers';
import { generateServeUrl } from '@/lib/utils';
import type { ImageRecord } from '@/types';
import styles from './RecentUploads.module.css';

interface RecentUploadsProps {
  images: ImageRecord[];
}

export function RecentUploads({ images }: RecentUploadsProps) {
  if (images.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Recent Uploads</h2>
        <p className={styles.empty}>No images uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Recent Uploads</h2>
      <ul className={styles.list}>
        {images.map((image) => (
          <li key={image.id} className={styles.row}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.thumb}
              src={generateServeUrl(image.storagePath, { w: 96, q: 60 })}
              alt={image.altText || image.originalName}
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== image.publicUrl) {
                  target.src = image.publicUrl;
                }
              }}
            />
            <div className={styles.info}>
              <span className={styles.name}>{image.originalName}</span>
              <span className={styles.meta}>
                {formatBytes(image.fileSize)} · {formatRelativeTime(image.createdAt)}
              </span>
            </div>
            <Link
              href={`/images/${image.id}`}
              className={styles.arrow}
              aria-label={`View ${image.originalName}`}
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
