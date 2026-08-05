'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { validateFile } from '@/lib/upload-helpers';
import styles from './DropZone.module.css';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesAdded, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { toast } = useToast();

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const valid: File[] = [];
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
      } else {
        valid.push(file);
      }
    }
    if (valid.length > 0) {
      onFilesAdded(valid);
      toast.info(`${valid.length} file(s) added to queue`);
    }
  };

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragCounter.current += 1;
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragCounter.current = 0;
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className={styles.icon} aria-hidden="true">
        📁
      </div>
      <div className={styles.title}>Drag &amp; drop images here</div>
      <div className={styles.subtitle}>or click to browse</div>
      <div className={styles.formats}>
        JPEG · PNG · WebP · GIF · AVIF · SVG — max 10 MB per file
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
