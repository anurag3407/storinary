'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatRelativeTime } from '@/lib/upload-helpers';
import type { ImageRecord } from '@/types';
import styles from './ImageMeta.module.css';

interface ImageMetaProps {
  image: ImageRecord;
}

type EditableField = 'tags' | 'altText' | 'folder';

const FIELD_LABELS: Record<EditableField, string> = {
  tags: 'Tags',
  altText: 'Alt Text',
  folder: 'Folder',
};

export function ImageMeta({ image }: ImageMetaProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

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
        </tbody>
      </table>
    </div>
  );
}
