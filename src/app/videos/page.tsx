'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Pagination } from '@/components/gallery/Pagination';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import { useMetadataFields } from '@/components/image-detail/useMetadataFields';
import type { VideoClipRecord, VideoListResponse, VideoRecord } from '@/types';
import type { CollectionRecord } from '@/lib/collections';
import { Badge } from '@/components/ui/Badge';
import { StructuredMetadataControls } from '@/components/media/StructuredMetadataControls';
import styles from './videos.module.css';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

const DEFAULT_FILTERS = {
  page: 1,
  limit: 12,
  sort: 'createdAt',
  order: 'desc',
};

function AdaptiveVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!src.endsWith('.m3u8') || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (src.endsWith('.mpd')) {
      let disposed = false;
      void import('dashjs').then(({ MediaPlayer }) => {
        if (disposed) return;
        const player = MediaPlayer().create();
        player.initialize(video, src, false);
        video.dataset.dashPlayer = 'ready';
      });
      return () => {
        disposed = true;
      };
    } else {
      video.src = src;
      return;
    }

    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      hls.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return <video ref={videoRef} controls preload="metadata" poster={poster} />;
}

async function captureVideoPoster(file: File): Promise<File | null> {
  if (!['video/mp4', 'video/webm'].includes(file.type)) return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;

    let settled = false;
    const finish = (result: File | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0.1, (video.duration || 2) / 4));
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => finish(blob ? new File([blob], `${file.name}.webp`, { type: 'image/webp' }) : null),
          'image/webp',
          0.82
        );
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 5000);
  });
}

export default function VideosPage() {
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [pagination, setPagination] = useState<VideoListResponse['pagination']>({
    page: DEFAULT_FILTERS.page,
    limit: DEFAULT_FILTERS.limit,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    search: '',
    folder: '',
    metadata: undefined as string | undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const metadataFields = useMetadataFields();
  const [importUrl, setImportUrl] = useState('');
  const [generatingHlsId, setGeneratingHlsId] = useState('');
  const [generatingDashId, setGeneratingDashId] = useState('');
  const [analyzingAiId, setAnalyzingAiId] = useState('');
  const [savingMetadataId, setSavingMetadataId] = useState('');
  const [clipDrafts, setClipDrafts] = useState<Record<string, { name: string; start: string; duration: string }>>({});
  const [clipBusyId, setClipBusyId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<number | null>(null);

  const loadCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/collections', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setCollections(data.collections ?? []);
    } catch {
      // Collections are optional workflow metadata.
    }
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const addToCollection = async (collectionId: string) => {
    if (videos.length === 0) return;
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', videoIds: videos.map((video) => video.id) }),
      });
      if (!response.ok) throw new Error();
      toast.success(`Added ${videos.length} current video(s) to collection`);
      await loadCollections();
    } catch {
      toast.error('Could not update collection');
    }
  };

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
        sort: filters.sort,
        order: filters.order,
      });
      if (filters.search) query.set('search', filters.search);
      if (filters.folder) query.set('folder', filters.folder);
      if (filters.metadata) query.set('metadata', filters.metadata);

      const response = await fetch(`/api/videos?${query.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load videos');
      const data = (await response.json()) as VideoListResponse;
      setVideos(data.videos);
      setPagination(data.pagination);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load videos');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (filters.search !== undefined) {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = window.setTimeout(() => {
        void loadVideos();
      }, 300);
      return () => {
        if (searchDebounceRef.current !== null) {
          window.clearTimeout(searchDebounceRef.current);
        }
      };
    }
    void loadVideos();
  }, [filters.search, loadVideos]);

  const uploadVideos = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('file', file));
      for (const file of Array.from(files)) {
        const poster = await captureVideoPoster(file);
        if (poster) formData.append(`poster-${file.name}`, poster);
      }
      if (folder) formData.set('folder', folder.startsWith('/') ? folder : `/${folder}`);
      if (tags) formData.set('tags', tags);
      formData.set('renditions', 'true');

      const response = await fetch('/api/videos', { method: 'POST', body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(body.error || 'Upload failed');
      }
      toast.success(`${files.length} video(s) uploaded`);
      setFilters((current) => ({ ...current, page: DEFAULT_FILTERS.page }));
      await loadVideos();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importVideoFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setIsUploading(true);
    try {
      const response = await fetch('/api/import/videos?renditions=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url], folder, tags }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(body.error || 'Import failed');
      }
      const body = await response.json();
      if (body.errors?.length) throw new Error(body.errors[0].error);
      toast.success('Video imported');
      setImportUrl('');
      setFilters((current) => ({ ...current, page: DEFAULT_FILTERS.page }));
      await loadVideos();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Import failed');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteVideo = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setVideos((current) => current.filter((video) => video.id !== id));
      setPagination((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      toast.success('Video deleted');
    } catch {
      toast.error('Could not delete video');
    } finally {
      setDeletingId('');
    }
  };

  const generateHls = async (id: string) => {
    setGeneratingHlsId(id);
    try {
      const response = await fetch(`/api/videos/${id}/hls?variants=360p,720p`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to generate adaptive stream' }));
        throw new Error(result.error || 'Unable to generate adaptive stream');
      }
      toast.success('Adaptive stream ready');
      await loadVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate adaptive stream');
    } finally {
      setGeneratingHlsId('');
    }
  };

  const generateDash = async (id: string) => {
    setGeneratingDashId(id);
    try {
      const response = await fetch(`/api/videos/${id}/dash?variants=360p,720p`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to generate DASH stream' }));
        throw new Error(result.error || 'Unable to generate DASH stream');
      }
      toast.success('DASH stream ready');
      await loadVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate DASH stream');
    } finally {
      setGeneratingDashId('');
    }
  };

  const analyzeVideoWithAi = async (id: string) => {
    setAnalyzingAiId(id);
    try {
      const response = await fetch(`/api/videos/${id}/ai`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to analyze video' }));
        throw new Error(result.error || 'Unable to analyze video');
      }
      toast.success('AI video insights ready');
      await loadVideos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to analyze video');
    } finally {
      setAnalyzingAiId('');
    }
  };

  const saveVideoMetadata = async (id: string, externalId: string, value: string) => {
    const busyId = `${id}:${externalId}`;
    setSavingMetadataId(busyId);
    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { [externalId]: value } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to save metadata');
      setVideos((current) => current.map((video) => {
        if (video.id !== id) return video;
        const metadata = { ...video.metadata };
        if (value === '') delete metadata[externalId];
        else metadata[externalId] = value;
        return { ...video, metadata };
      }));
      toast.success('Metadata saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save metadata');
    } finally {
      setSavingMetadataId('');
    }
  };

  const createClip = async (videoId: string) => {
    const draft = clipDrafts[videoId];
    if (!draft?.name.trim() || !draft.start.trim() || !draft.duration.trim()) {
      toast.error('Clip name, start, and duration are required');
      return;
    }
    setClipBusyId(videoId);
    try {
      const response = await fetch(`/api/videos/${videoId}/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persist: true,
          name: draft.name.trim(),
          start: Number(draft.start),
          duration: Number(draft.duration),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to create clip');
      setVideos((current) => current.map((video) => video.id === videoId
        ? { ...video, clips: [...(video.clips ?? []), result.clip as VideoClipRecord] }
        : video));
      setClipDrafts((current) => ({ ...current, [videoId]: { name: '', start: '', duration: '' } }));
      toast.success('Clip created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create clip');
    } finally {
      setClipBusyId('');
    }
  };

  const deleteClip = async (videoId: string, clipName: string) => {
    setClipBusyId(`${videoId}:${clipName}`);
    try {
      const response = await fetch(
        `/api/videos/${videoId}/clip/${encodeURIComponent(clipName)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Unable to delete clip');
      }
      setVideos((current) => current.map((video) => video.id === videoId
        ? { ...video, clips: (video.clips ?? []).filter((clip) => clip.name !== clipName) }
        : video));
      toast.success('Clip deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete clip');
    } finally {
      setClipBusyId('');
    }
  };

  return (
    <div className={styles.page}>
      <Header title="Videos" description="Upload and stream MP4 or WebM assets with range requests." />

      <section className={styles.uploader}>
        <input
          aria-label="Search videos"
          className={styles.libraryInput}
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: DEFAULT_FILTERS.page }))}
          placeholder="Search name, tags, or alt text"
        />
        <input
          aria-label="Filter videos by folder"
          className={styles.libraryInput}
          value={filters.folder}
          onChange={(event) => setFilters((current) => ({ ...current, folder: event.target.value, page: DEFAULT_FILTERS.page }))}
          placeholder="Folder filter"
        />
        {metadataFields.map((field) => (
          <select
            key={field.id}
            aria-label={`Filter by ${field.label}`}
            className={styles.librarySelect}
            value={new URLSearchParams(filters.metadata ?? '').get(field.externalId) ?? ''}
            onChange={(event) => {
              const next = new URLSearchParams(filters.metadata ?? '');
              if (event.target.value) next.set(field.externalId, event.target.value);
              else next.delete(field.externalId);
              setFilters((current) => ({
                ...current,
                metadata: next.toString() || undefined,
                page: DEFAULT_FILTERS.page,
              }));
            }}
          >
            <option value="">{`${field.label}: all`}</option>
            {field.allowedValues.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ))}
        <input className="nb-input" value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="Folder (/videos)" />
        <input className="nb-input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (comma separated)" />
        <input
          ref={fileInputRef}
          accept="video/mp4,video/quicktime,video/webm"
          multiple
          type="file"
          onChange={(event) => void uploadVideos(event.target.files)}
          disabled={isUploading}
        />
        <Button onClick={() => fileInputRef.current?.click()} loading={isUploading}>
          Choose Videos
        </Button>
        <input
          aria-label="Import video URL"
          className="nb-input"
          value={importUrl}
          onChange={(event) => setImportUrl(event.target.value)}
          placeholder="https://example.com/video.mp4"
        />
        <Button onClick={() => void importVideoFromUrl()} loading={isUploading} disabled={!importUrl.trim()}>
          Import URL
        </Button>
        <select
          aria-label="Sort videos"
          className={styles.librarySelect}
          value={`${filters.sort}:${filters.order}`}
          onChange={(event) => {
            const [sort, order] = event.target.value.split(':') as [typeof filters.sort, typeof filters.order];
            setFilters((current) => ({ ...current, sort, order, page: DEFAULT_FILTERS.page }));
          }}
        >
          <option value="createdAt:desc">Newest</option>
          <option value="createdAt:asc">Oldest</option>
          <option value="duration:desc">Longest</option>
          <option value="duration:asc">Shortest</option>
          <option value="fileSize:desc">Largest</option>
          <option value="fileSize:asc">Smallest</option>
          <option value="originalName:asc">Name A–Z</option>
          <option value="originalName:desc">Name Z–A</option>
        </select>
        {collections.length > 0 && (
          <select
            aria-label="Add current page to collection"
            className={styles.librarySelect}
            defaultValue=""
            onChange={(event) => {
              const collectionId = event.target.value;
              event.currentTarget.value = '';
              if (collectionId) void addToCollection(collectionId);
            }}
          >
            <option value="">Add page to collection…</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        )}
      </section>

      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" description={error} action={<Button variant="secondary" onClick={() => void loadVideos()}>Try Again</Button>} />
      ) : videos.length === 0 ? (
          <EmptyState icon="🎬" title="No videos found" description={filters.search || filters.folder ? 'Try a different search or folder.' : 'Upload your first video to get started.'} />
      ) : (
        <div className={styles.grid}>
          {videos.map((video) => (
            <article key={video.id} className={styles.card}>
              <AdaptiveVideo
                src={video.hlsPackages[0]
                  ? `/api/videos/${video.id}/hls/${encodeURIComponent(video.hlsPackages[0].label)}/master.m3u8`
                  : video.dashPackages[0]
                    ? `/api/videos/${video.id}/dash/${encodeURIComponent(video.dashPackages[0].label)}/manifest.mpd`
                  : `/api/videos/${video.id}/stream`}
                poster={video.posterPath ? `/api/videos/${video.id}/poster` : undefined}
              />
              <div className={styles.body}>
                <strong>{video.originalName}</strong>
                <span>
                  {formatDuration(video.duration)} · {(video.fileSize / (1024 * 1024)).toFixed(1)} MB · {video.format.toUpperCase()}
                </span>
                <div>
                  {Object.entries(video.metadata ?? {}).map(([externalId, value]) => (
                    <Badge key={externalId}>{`${externalId}: ${value}`}</Badge>
                  ))}
                </div>
                <StructuredMetadataControls
                  fields={metadataFields}
                  metadata={video.metadata}
                  savingExternalId={savingMetadataId.startsWith(`${video.id}:`) ? savingMetadataId.split(':')[1] : null}
                  onSave={(externalId, value) => saveVideoMetadata(video.id, externalId, value)}
                />
                <div className={styles.clipPanel}>
                  <strong>Named clips</strong>
                  {(video.clips ?? []).map((clip) => (
                    <div key={clip.id} className={styles.clipRow}>
                      <span>{`${clip.name} · ${formatDuration(clip.durationSeconds)}${clip.muted ? ' · muted' : ''}`}</span>
                      <div>
                        <Button variant="secondary" size="sm" onClick={async () => {
                          await copy(`${window.location.origin}${clip.publicUrl}`);
                          toast.success('Clip URL copied');
                        }}>Copy URL</Button>
                        <Button variant="danger" size="sm" loading={clipBusyId === `${video.id}:${clip.name}`} onClick={() => void deleteClip(video.id, clip.name)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                  {(video.clips ?? []).length === 0 && <span className={styles.clipEmpty}>No named clips yet.</span>}
                  <div className={styles.clipForm}>
                    <input aria-label="Clip name" placeholder="Name" value={clipDrafts[video.id]?.name ?? ''} onChange={(event) => setClipDrafts((current) => ({ ...current, [video.id]: { name: event.target.value, start: current[video.id]?.start ?? '', duration: current[video.id]?.duration ?? '' } }))} />
                    <input aria-label="Clip start seconds" type="number" min="0" step="0.1" placeholder="Start" value={clipDrafts[video.id]?.start ?? ''} onChange={(event) => setClipDrafts((current) => ({ ...current, [video.id]: { name: current[video.id]?.name ?? '', start: event.target.value, duration: current[video.id]?.duration ?? '' } }))} />
                    <input aria-label="Clip duration seconds" type="number" min="0.1" step="0.1" placeholder="Duration" value={clipDrafts[video.id]?.duration ?? ''} onChange={(event) => setClipDrafts((current) => ({ ...current, [video.id]: { name: current[video.id]?.name ?? '', start: current[video.id]?.start ?? '', duration: event.target.value } }))} />
                    <Button size="sm" loading={clipBusyId === video.id} onClick={() => void createClip(video.id)}>Create</Button>
                  </div>
                </div>
                <div>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={analyzingAiId === video.id}
                    onClick={() => void analyzeVideoWithAi(video.id)}
                  >
                    Analyze AI
                  </Button>
                  {video.hlsPackages.length === 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={generatingHlsId === video.id}
                      onClick={() => void generateHls(video.id)}
                    >
                      Create ABR
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await copy(`${window.location.origin}/api/videos/${video.id}/hls/${encodeURIComponent(video.hlsPackages[0].label)}/master.m3u8`);
                        toast.success('ABR URL copied');
                      }}
                    >
                      Copy ABR URL
                    </Button>
                  )}
                  {video.dashPackages.length === 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={generatingDashId === video.id}
                      onClick={() => void generateDash(video.id)}
                    >
                      Create DASH
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await copy(`${window.location.origin}/api/videos/${video.id}/dash/${encodeURIComponent(video.dashPackages[0].label)}/manifest.mpd`);
                        toast.success('DASH URL copied');
                      }}
                    >
                      Copy DASH URL
                    </Button>
                  )}
                  {video.renditions.map((rendition) => (
                    <Button
                      key={rendition.id}
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await copy(`${window.location.origin}/api/videos/${video.id}/stream?rendition=${rendition.label}`);
                        toast.success(`${rendition.label} URL copied`);
                      }}
                    >
                      Copy {rendition.label}
                    </Button>
                  ))}
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deletingId === video.id}
                    onClick={() => void deleteVideo(video.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
      />
    </div>
  );
}
