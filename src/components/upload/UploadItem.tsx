'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import { formatBytes } from '@/lib/upload-helpers';
import type { UploadItem as UploadItemType } from '@/types';
import styles from './UploadItem.module.css';

interface UploadItemProps {
  item: UploadItemType;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function UploadItem({ item, onRemove, onRetry }: UploadItemProps) {
  const { copy } = useClipboard();
  const { toast } = useToast();

  const copyUrl = async () => {
    if (!item.result) return;
    await copy(item.result.publicUrl);
    toast.success('URL copied!');
  };

  return (
    <div className={styles.item}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewUrl} alt="" className={styles.thumb} />

      <div className={styles.info}>
        <span className={styles.filename} title={item.file.name}>
          {item.file.name}
        </span>
        <span className={styles.size}>{formatBytes(item.file.size)}</span>
        {item.error && <span className={styles.error}>{item.error}</span>}
        {item.moderation && (
          <span className={styles.size}>
            Local moderation: {item.moderation.safe ? 'passed' : 'blocked'} ({Math.round(item.moderation.score * 100)}%)
          </span>
        )}
      </div>

      <div className={styles.status}>
        {item.status === 'pending' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant="default">Pending</Badge>
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRetry(item.id)}
              >
                Upload
              </Button>
            )}
          </div>
        )}

        {item.status === 'compressing' && (
          <>
            <Spinner size="sm" />
            <Badge variant="info">Compressing</Badge>
          </>
        )}

        {item.status === 'removing-bg' && (
          <>
            <Spinner size="sm" />
            <Badge variant="info">Removing BG</Badge>
          </>
        )}

        {item.status === 'moderating' && (
          <>
            <Spinner size="sm" />
            <Badge variant="info">AI Review</Badge>
          </>
        )}

        {item.status === 'uploading' && (
          <div className={styles.progressWrap}>
            <ProgressBar value={item.progress} size="sm" showLabel />
          </div>
        )}

        {item.status === 'done' && (
          <>
            <Badge variant="success">Done</Badge>
            <Button variant="outline" size="sm" icon="📋" onClick={copyUrl}>
              Copy URL
            </Button>
          </>
        )}

        {item.status === 'error' && (
          <>
            <Badge variant="danger">Error</Badge>
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRetry(item.id)}
              >
                Retry
              </Button>
            )}
          </>
        )}
      </div>

      {(item.status === 'pending' || item.status === 'error') && (
        <button
          type="button"
          className={styles.remove}
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.file.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
