'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { StructuredMetadataControls } from '@/components/media/StructuredMetadataControls';
import { useMetadataFields } from './useMetadataFields';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatRelativeTime } from '@/lib/upload-helpers';
import type { ImageRecord, ImageVersionRecord } from '@/types';
import styles from './ImageMeta.module.css';

interface ImageMetaProps {
  image: ImageRecord;
  versions?: ImageVersionRecord[];
}

type EditableField = 'tags' | 'altText' | 'folder';

const FIELD_LABELS: Record<EditableField, string> = {
  tags: 'Tags',
  altText: 'Alt Text',
  folder: 'Folder',
};

export function ImageMeta({ image, versions = [] }: ImageMetaProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const metadataFields = useMetadataFields();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);

  const startEdit = (field: EditableField, current: string) => {
    setEditing(field);
    setValue(current);
  };

  const save = async () => {
    if (!editing || saving) return;
    const field = editing;
    setEditing(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`${FIELD_LABELS[field]} saved`);
      router.refresh();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const patchAsset = async (body: Record<string, unknown>, successMessage: string) => {
    const response = await fetch(`/api/images/${image.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Failed to ${successMessage.toLowerCase()}`);
    toast.success(successMessage);
    router.refresh();
  };

  const fileToBase64 = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  const replaceImage = async (file?: File) => {
    if (!file || saving) return;
    setSaving(true);
    try {
      await patchAsset({
        file: { name: file.name, type: file.type, data: await fileToBase64(file) },
      }, 'Image replaced');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to replace image');
    } finally {
      setSaving(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const restoreVersion = async (version: ImageVersionRecord) => {
    if (busyVersionId || saving) return;
    setBusyVersionId(version.id);
    try {
      await patchAsset({ restoreVersionId: version.id }, 'Version restored');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore version');
    } finally {
      setBusyVersionId(null);
    }
  };

  const analyzeWithAi = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/images/${image.id}/ai`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'AI analysis failed' }));
        throw new Error(result.error || 'AI analysis failed');
      }
      toast.success('AI tags and moderation updated');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveMetadata = async (externalId: string, nextValue: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/media/${image.id}?resource_type=image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { [externalId]: nextValue } }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save metadata');
      }
      toast.success('Metadata saved');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  const renderEditable = (field: EditableField, current: string) => {
    if (editing === field) {
      return (
        <input
          className="nb-input"
          autoFocus
          value={value}
          placeholder={FIELD_LABELS[field]}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(null);
          }}
        />
      );
    }
    return (
      <span className={styles.editableValue}>
        {field === 'tags' && current ? (
          <span className={styles.tags}>
            {current
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <Badge key={t} variant="info">
                  {t}
                </Badge>
              ))}
          </span>
        ) : (
          <span className={current ? '' : styles.muted}>{current || '—'}</span>
        )}
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => startEdit(field, current)}
          aria-label={`Edit ${FIELD_LABELS[field]}`}
        >
          ✏️
        </button>
      </span>
    );
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Details</h2>
      <table className="nb-table">
        <tbody>
          <tr>
            <th>Filename</th>
            <td>{image.originalName}</td>
          </tr>
          <tr>
            <th>Dimensions</th>
            <td>
              {image.width} × {image.height} px
            </td>
          </tr>
          <tr>
            <th>File Size</th>
            <td>{formatBytes(image.fileSize)}</td>
          </tr>
          <tr>
            <th>Format</th>
            <td>
              <Badge>{image.format.toUpperCase()}</Badge>
            </td>
          </tr>
          <tr>
            <th>Folder</th>
            <td>{renderEditable('folder', image.folder)}</td>
          </tr>
          <tr>
            <th>Tags</th>
            <td>{renderEditable('tags', image.tags)}</td>
          </tr>
          <tr>
            <th>Alt Text</th>
            <td>{renderEditable('altText', image.altText)}</td>
          </tr>
          <tr>
            <th>Uploaded</th>
            <td title={new Date(image.createdAt).toLocaleString()}>
              {formatRelativeTime(image.createdAt)}
            </td>
          </tr>
          {versions.length > 0 && (
            <tr>
              <th>History</th>
              <td>
                <>
                  <input
                    ref={replaceInputRef}
                    className={styles.replaceInput}
                    type="file"
                    accept="image/*"
                    aria-label="Replace image"
                    onChange={(event) => void replaceImage(event.target.files?.[0])}
                  />
                  <ol className={styles.versionList}>
                    {versions.map((version) => (
                      <li key={version.id}>
                        <span className={styles.versionLabel}>
                          v{version.version} · {version.label}
                        </span>
                        <a href={version.publicUrl} target="_blank" rel="noopener noreferrer">
                          {version.originalName}
                        </a>
                        <small>{formatBytes(version.fileSize)}</small>
                        <button
                          type="button"
                          onClick={() => void restoreVersion(version)}
                          disabled={busyVersionId === version.id || saving}
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              </td>
            </tr>
          )}
          <tr>
            <th>Background</th>
            <td>
              <Badge variant={image.bgRemoved ? 'success' : 'default'}>
                {image.bgRemoved ? 'Removed' : 'Intact'}
              </Badge>
            </td>
          </tr>
          <tr>
            <th>Compressed</th>
            <td>
              <Badge variant={image.compressed ? 'success' : 'default'}>
                {image.compressed ? 'Yes' : 'No'}
              </Badge>
            </td>
          </tr>
          <tr>
            <th>AI Moderation</th>
            <td>
              <span className={styles.versionList}>
                <Badge variant={image.aiModerated ? 'success' : 'default'}>
                  {image.aiModerated ? `Score ${Math.round((image.aiModerationScore ?? 0) * 100)}%` : 'Not analyzed'}
                </Badge>
                <button type="button" onClick={() => void analyzeWithAi()} disabled={analyzing}>
                  {analyzing ? 'Analyzing…' : 'Analyze with AI'}
                </button>
              </span>
            </td>
          </tr>
          {metadataFields.length > 0 && (
            <tr>
              <th>Structured Metadata</th>
              <td>
                <StructuredMetadataControls
                  fields={metadataFields}
                  metadata={image.metadata}
                  savingExternalId={saving ? 'structured-metadata' : null}
                  onSave={(externalId, value) => saveMetadata(externalId, value)}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
