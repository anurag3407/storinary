'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CompressionSelector } from '@/components/upload/CompressionSelector';
import type { ImageRecord, TransformParams } from '@/types';
import styles from './TransformPanel.module.css';

interface TransformPanelProps {
  image: ImageRecord;
  onTransformChange?: (params: TransformParams) => void;
}

const PRESETS: Array<{ label: string; params: TransformParams }> = [
  { label: '150×150 Thumb', params: { w: 150, h: 150, fit: 'cover' } },
  { label: '800×600 Medium', params: { w: 800, h: 600, fit: 'inside' } },
  { label: '1920×1080 Full HD', params: { w: 1920, h: 1080, fit: 'inside' } },
  { label: '1200×630 Social', params: { w: 1200, h: 630, fit: 'cover' } },
];

export function TransformPanel({ image, onTransformChange }: TransformPanelProps) {
  const [params, setParams] = useState<TransformParams>({ q: 80 });
  const timerRef = useRef<number | null>(null);

  const update = (next: TransformParams) => {
    setParams(next);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onTransformChange?.(next);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setParams({});
    onTransformChange?.({});
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Transform</h2>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-width">
            Width
          </label>
          <input
            id="tf-width"
            className="nb-input"
            type="number"
            min="1"
            max="8192"
            placeholder={String(image.width)}
            value={params.w ?? ''}
            onChange={(e) =>
              update({ ...params, w: e.target.value ? parseInt(e.target.value, 10) : undefined })
            }
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-height">
            Height
          </label>
          <input
            id="tf-height"
            className="nb-input"
            type="number"
            min="1"
            max="8192"
            placeholder={String(image.height)}
            value={params.h ?? ''}
            onChange={(e) =>
              update({ ...params, h: e.target.value ? parseInt(e.target.value, 10) : undefined })
            }
          />
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <CompressionSelector
            idPrefix="tf"
            quality={typeof params.q === 'number' ? params.q : 80}
            onChange={(q) => update({ ...params, q })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-format">
            Format
          </label>
          <select
            id="tf-format"
            className="nb-select"
            value={params.fmt ?? ''}
            onChange={(e) =>
              update({
                ...params,
                fmt: e.target.value
                  ? (e.target.value as TransformParams['fmt'])
                  : undefined,
              })
            }
          >
            <option value="">Original ({image.format})</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-fit">
            Fit
          </label>
          <select
            id="tf-fit"
            className="nb-select"
            value={params.fit ?? ''}
            onChange={(e) =>
              update({
                ...params,
                fit: e.target.value
                  ? (e.target.value as TransformParams['fit'])
                  : undefined,
              })
            }
          >
            <option value="">Default (inside)</option>
            <option value="inside">Inside (default)</option>
            <option value="cover">Cover (crop)</option>
            <option value="contain">Contain (letterbox)</option>
            <option value="fill">Fill (stretch)</option>
          </select>
        </div>
      </div>

      <div className={styles.presets}>
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => update(preset.params)}
          >
            {preset.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
