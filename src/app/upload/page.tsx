'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { DropZone } from '@/components/upload/DropZone';
import { UploadQueue } from '@/components/upload/UploadQueue';
import { UploadSettings } from '@/components/upload/UploadSettings';
import { Button } from '@/components/ui/Button';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import { useUpload } from '@/hooks/useUpload';
import styles from './upload.module.css';

export default function UploadPage() {
  const {
    state,
    addFiles,
    removeFile,
    updateGlobalOptions,
    startUpload,
    clearCompleted,
    reset,
  } = useUpload();
  const { toast } = useToast();
  const { copy } = useClipboard();

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
        onChange={updateGlobalOptions}
        disabled={isUploading}
      />

      <DropZone onFilesAdded={addFiles} disabled={isUploading} />

      <UploadQueue items={items} onRemove={removeFile} />

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
