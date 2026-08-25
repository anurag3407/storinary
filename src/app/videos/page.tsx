'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import type { VideoListResponse, VideoRecord } from '@/types';
import styles from './videos.module.css';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export default function VideosPage() {
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/videos?limit=100', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load videos');
      setVideos(((await response.json()) as VideoListResponse).videos);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load videos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  return (
    <div className={styles.page}>
      <Header title="Videos" description="Upload and stream MP4 or WebM assets with range requests." />

      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" description={error} action={<Button variant="secondary" onClick={() => void loadVideos()}>Try Again</Button>} />
      ) : videos.length === 0 ? (
        <EmptyState icon="🎬" title="No videos yet" description="Use the authenticated video API to add your first asset." />
      ) : (
        <div className={styles.grid}>
          {videos.map((video) => (
            <article key={video.id} className={styles.card}>
              <video controls preload="metadata" src={`/api/videos/${video.id}/stream`} />
              <div className={styles.body}>
                <strong>{video.originalName}</strong>
                <span>
                  {formatDuration(video.duration)} · {(video.fileSize / (1024 * 1024)).toFixed(1)} MB · {video.format.toUpperCase()}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await copy(`${window.location.origin}/api/videos/${video.id}/stream`);
                    toast.success('Streaming URL copied');
                  }}
                >
                  Copy Stream URL
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
