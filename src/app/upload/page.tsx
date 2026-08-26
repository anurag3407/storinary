'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DropZone } from '@/components/upload/DropZone';
import { UploadQueue } from '@/components/upload/UploadQueue';
import { UploadSettings } from '@/components/upload/UploadSettings';
import { Button } from '@/components/ui/Button';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import { useUpload } from '@/hooks/useUpload';
import type { UploadPresetRecord } from '@/lib/upload-presets';
import styles from './upload.module.css';

export default function UploadPage() {
  const {
    state,
    addFiles,
    removeFile,
    updateGlobalOptions,
    startUpload,
    reset,
  } = useUpload();
  const { selectedPreset, selectUploadPreset } = useUpload();
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [presets, setPresets] = useState<UploadPresetRecord[]>([]);
  const [importUrls, setImportUrls] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const { items, globalOptions, isUploading } = state;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const doneItems = items.filter((i) => i.status === 'done' && i.result);

  // Keyboard shortcut: Ctrl/Cmd + V pastes images into the queue
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
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
        addFiles(files);
        toast.info(`Pasted ${files.length} image(s)`);
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [addFiles, toast]);

  useEffect(() => {
    fetch('/api/upload-presets?active=true', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { presets: [] }))
      .then((data) => setPresets(data.presets ?? []))
      .catch(() => setPresets([]));
  }, []);

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
    if (!result) return;
    if (result.failed > 0) {
      toast.warning(`Uploaded ${result.completed}, ${result.failed} failed`);
    } else if (result.completed > 0) {
      toast.success(`Uploaded ${result.completed} image(s) successfully`);
    }
  };

  const importFromUrls = async () => {
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
              icon="🗑️"
              onClick={handleClearAll}
              disabled={isUploading || items.length === 0}
            >
              Clear All
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="⬆️"
              onClick={handleUploadAll}
              disabled={isUploading || pendingCount === 0}
              loading={isUploading}
            >
              {isUploading ? 'Uploading…' : `Upload All (${pendingCount})`}
            </Button>
          </>
        }
      />

      <UploadSettings
        options={globalOptions}
        presets={presets}
        selectedPreset={selectedPreset}
        onPresetChange={handleSelectPreset}
        onChange={updateGlobalOptions}
        disabled={isUploading}
      />

      <DropZone onFilesAdded={addFiles} disabled={isUploading} />

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
          <Button onClick={() => void importFromUrls()} loading={isImporting} disabled={!importUrls.trim()}>
            Import Images
          </Button>
        </div>
        {isImporting && (
          <p role="status">Importing URLs. Results appear in your toast notifications.</p>
        )}
      </section>

      <UploadQueue items={items} onRemove={removeFile} onRetry={() => void startUpload()} />

      {doneItems.length > 0 && (
        <div className={styles.completedPanel}>
          <div className={styles.completedHeader}>
            <h2 className={styles.completedTitle}>Completed Uploads</h2>
            <span className={styles.completedCount}>
              {doneItems.length} image(s) ready to use
            </span>
          </div>
          <div className={styles.completedActions}>
            <Button variant="secondary" size="sm" icon="🔗" onClick={() => copyLinks('direct')}>
              Copy URLs
            </Button>
            <Button variant="secondary" size="sm" icon="🌐" onClick={() => copyLinks('html')}>
              Copy HTML
            </Button>
            <Button variant="secondary" size="sm" icon="📝" onClick={() => copyLinks('markdown')}>
              Copy Markdown
            </Button>
            <Button variant="primary" size="sm" icon="📋" onClick={() => copyLinks('all')}>
              Copy All Formats
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
