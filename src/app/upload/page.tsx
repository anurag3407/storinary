'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DropZone } from '@/components/upload/DropZone';
import { UploadQueue } from '@/components/upload/UploadQueue';
import { UploadSettings } from '@/components/upload/UploadSettings';
import { Button } from '@/components/ui/Button';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import { useUpload } from '@/hooks/useUpload';
import type { UploadPresetRecord } from '@/lib/upload-presets';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { UploadIcon, GlobeIcon, ClipboardIcon, TrashIcon, LinkGlyphIcon, TagIcon } from '@/components/ui/icons';
import styles from './upload.module.css';

export default function UploadPage() {
  const {
    state,
    addFiles,
    removeFile,
    updateGlobalOptions,
    startUpload,
    reset,
    selectedPreset,
    selectUploadPreset,
  } = useUpload();
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [presets, setPresets] = useState<UploadPresetRecord[]>([]);
  const [importUrls, setImportUrls] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [quota, setQuota] = useState<{
    usedFormatted: string;
    limitFormatted: string;
    remainingFormatted: string;
    remainingBytes: number;
    percentage: number;
    isExceeded: boolean;
    isNearLimit: boolean;
  } | null>(null);

  const { items, globalOptions, isUploading } = state;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const doneItems = items.filter((i) => i.status === 'done' && i.result);

  const loadQuota = useCallback(() => {
    fetch('/api/quota', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.quota) setQuota(data.quota);
      })
      .catch(() => {});
  }, []);

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      if (quota?.isExceeded) {
        toast.error('Cannot upload: 100 MB storage quota reached. Please upgrade your plan.');
        setIsUpgradeModalOpen(true);
        return;
      }
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      if (quota && quota.remainingBytes !== undefined && totalBytes > quota.remainingBytes) {
        toast.error(`Cannot upload: Adding ${files.length} file(s) would exceed your remaining quota (${quota.remainingFormatted}). Please upgrade your plan.`);
        setIsUpgradeModalOpen(true);
        return;
      }
      // Queue only — the user reviews options (compression, background
      // removal, folder, tags) and presses "Upload All" to start.
      addFiles(files);
    },
    [addFiles, quota, toast]
  );

  // Keyboard shortcut: Ctrl/Cmd + V pastes images into the queue
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (quota?.isExceeded) return;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      const files: File[] = [];
      for (const item of Array.from(clipboardItems)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
        if (quota && quota.remainingBytes !== undefined && totalBytes > quota.remainingBytes) {
          toast.error(`Cannot paste: Adding ${files.length} file(s) would exceed your remaining quota (${quota.remainingFormatted}). Please upgrade your plan.`);
          setIsUpgradeModalOpen(true);
          return;
        }
        addFiles(files);
        toast.info(`Pasted ${files.length} image(s) — press Upload All to start`);
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [addFiles, toast, quota]);

  useEffect(() => {
    loadQuota();
    fetch('/api/upload-presets?active=true', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { presets: [] }))
      .then((data) => setPresets(data.presets ?? []))
      .catch(() => setPresets([]));
  }, [loadQuota]);

  const handleSelectPreset = (name: string) => {
    selectUploadPreset(name);
    const preset = presets.find((item) => item.name === name);
    if (!preset) return;
    updateGlobalOptions({
      folder: preset.folder,
      tags: preset.tags,
      compress: preset.compress,
      quality: preset.quality,
      maxWidth: preset.maxWidth,
      removeBg: preset.removeBg,
      moderate: preset.moderate,
    });
  };

  const handleClearAll = () => {
    reset();
    toast.info('Queue cleared');
  };

  const handleUploadAll = async () => {
    const result = await startUpload();
    loadQuota();
    window.dispatchEvent(new CustomEvent('storinary:quota-updated'));
    if (!result) return;
    if (result.failed > 0) {
      toast.warning(`Uploaded ${result.completed}, ${result.failed} failed`);
    } else if (result.completed > 0) {
      toast.success(`Uploaded ${result.completed} image(s) successfully`);
    }
  };

  const importFromUrls = async () => {
    if (quota?.isExceeded) {
      toast.error('Cannot import: 100 MB storage quota reached. Please upgrade your plan.');
      setIsUpgradeModalOpen(true);
      return;
    }

    const urls = importUrls
      .split(/\r?\n|,\s*/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (urls.length === 0) return;

    setIsImporting(true);
    try {
      const response = await fetch('/api/import/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          folder: globalOptions.folder,
          tags: globalOptions.tags,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(body.error || 'Import failed');
      }
      const body = await response.json();
      loadQuota();
      window.dispatchEvent(new CustomEvent('storinary:quota-updated'));
      if (body.errors?.length) {
        toast.warning(`Imported ${body.images.length}, ${body.errors.length} failed`);
      } else {
        toast.success(`Imported ${body.images.length} image(s)`);
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const copyLinks = async (format: 'direct' | 'markdown' | 'html' | 'all') => {
    const results = doneItems.map((i) => i.result!).filter(Boolean);
    if (results.length === 0) return;

    const build = (img: (typeof results)[number]) => {
      switch (format) {
        case 'direct':
          return img.publicUrl;
        case 'markdown':
          return `![${img.altText || img.originalName}](${img.publicUrl})`;
        case 'html':
          return `<img src="${img.publicUrl}" alt="${img.altText || img.originalName}" loading="lazy" />`;
        case 'all':
          return [
            `Direct: ${img.publicUrl}`,
            `HTML: <img src="${img.publicUrl}" alt="${img.altText || img.originalName}" loading="lazy" />`,
            `Markdown: ![${img.altText || img.originalName}](${img.publicUrl})`,
            `CSS: background-image: url('${img.publicUrl}');`,
          ].join('\n');
      }
    };

    const text = results.map(build).join('\n\n');
    const ok = await copy(text);
    toast.success(ok ? 'Links copied!' : 'Copy failed');
  };

  return (
    <div className={styles.page}>
      <Header
        title="Upload Images"
        description="Drag, drop, or paste images. Compress and remove backgrounds before they hit your CDN."
        actions={
          <>
            <Button
              variant="ghost"
              size="md"
              icon={<TrashIcon size={26} />}
              onClick={handleClearAll}
              disabled={isUploading || items.length === 0}
            >
              Clear All
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<UploadIcon size={16} />}
              onClick={handleUploadAll}
              disabled={isUploading || pendingCount === 0 || Boolean(quota?.isExceeded)}
              loading={isUploading}
            >
              {isUploading ? 'Uploading…' : `Upload All (${pendingCount})`}
            </Button>
          </>
        }
      />

      {quota && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 'var(--ui-radius-md, 8px)',
            marginBottom: '16px',
            backgroundColor: quota.isExceeded
              ? 'rgba(239, 68, 68, 0.1)'
              : quota.isNearLimit
                ? 'rgba(245, 158, 11, 0.1)'
                : 'var(--ui-surface)',
            border: `1px solid ${
              quota.isExceeded
                ? 'rgba(239, 68, 68, 0.4)'
                : quota.isNearLimit
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'var(--ui-border-strong)'
            }`,
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: quota.isExceeded
                  ? '#ef4444'
                  : quota.isNearLimit
                    ? '#f59e0b'
                    : 'var(--ui-primary, #8b5cf6)',
                color: 'white',
              }}
            >
              {quota.isExceeded ? 'Quota Exceeded' : quota.isNearLimit ? 'Storage Warning' : 'Account Quota'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--ui-text)' }}>
              {quota.isExceeded ? (
                <strong>100 MB free quota limit reached ({quota.usedFormatted} used). Uploads are paused until upgraded.</strong>
              ) : (
                <>
                  Using <strong>{quota.usedFormatted}</strong> of <strong>100 MB</strong> ({quota.percentage}% used • {quota.remainingFormatted} available)
                </>
              )}
            </span>
          </div>
          <Button
            variant={quota.isExceeded ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setIsUpgradeModalOpen(true)}
          >
            Upgrade Plan
          </Button>
        </div>
      )}

      <UploadSettings
        options={globalOptions}
        presets={presets}
        selectedPreset={selectedPreset}
        onPresetChange={handleSelectPreset}
        onChange={updateGlobalOptions}
        disabled={isUploading || Boolean(quota?.isExceeded)}
      />

      <DropZone onFilesAdded={handleFilesAdded} disabled={isUploading || Boolean(quota?.isExceeded)} />

      <section className={styles.importPanel}>
        <label htmlFor="image-import-urls">Import image URLs</label>
        <textarea
          id="image-import-urls"
          className="nb-input"
          rows={3}
          value={importUrls}
          onChange={(event) => setImportUrls(event.target.value)}
          placeholder="https://example.com/photo.jpg&#10;https://example.com/banner.png"
        />
        <div>
          <span>Public HTTPS URLs only. Maximum 10 per batch.</span>
          <Button
            onClick={() => void importFromUrls()}
            loading={isImporting}
            disabled={!importUrls.trim() || Boolean(quota?.isExceeded)}
          >
            Import Images
          </Button>
        </div>
        {isImporting && (
          <p role="status">Importing URLs. Results appear in your toast notifications.</p>
        )}
      </section>

      <UploadQueue
        items={items}
        onRemove={removeFile}
        onRetry={() => void startUpload()}
        onUploadAll={handleUploadAll}
        isUploading={isUploading}
      />

      {doneItems.length > 0 && (
        <div className={styles.completedPanel}>
          <div className={styles.completedHeader}>
            <h2 className={styles.completedTitle}>Completed Uploads</h2>
            <span className={styles.completedCount}>
              {doneItems.length} image(s) ready to use
            </span>
          </div>
          <div className={styles.completedActions}>
            <Button variant="secondary" size="sm" icon={<LinkGlyphIcon size={15} />} onClick={() => copyLinks('direct')}>
              Copy URLs
            </Button>
            <Button variant="secondary" size="sm" icon={<GlobeIcon size={16} />} onClick={() => copyLinks('html')}>
              Copy HTML
            </Button>
            <Button variant="secondary" size="sm" icon={<TagIcon size={15} />} onClick={() => copyLinks('markdown')}>
              Copy Markdown
            </Button>
            <Button variant="primary" size="sm" icon={<ClipboardIcon size={16} />} onClick={() => copyLinks('all')}>
              Copy All Formats
            </Button>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentUsageFormatted={quota?.usedFormatted || '0 B'}
      />
    </div>
  );
}
