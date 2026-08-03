'use client';

import type { UploadState } from '@/types';
import styles from './UploadSettings.module.css';

interface UploadSettingsProps {
  options: UploadState['globalOptions'];
  onChange: (options: Partial<UploadState['globalOptions']>) => void;
  disabled?: boolean;
}

export function UploadSettings({ options, onChange, disabled }: UploadSettingsProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Upload Options</h2>
      <div className={styles.grid}>
        <label className="nb-checkbox">
          <input
            type="checkbox"
            checked={options.compress}
            disabled={disabled}
            onChange={(e) => onChange({ compress: e.target.checked })}
          />
          Compress to WebP
        </label>

        {options.compress && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="upload-quality">
                Quality: {options.quality}%
              </label>
              <input
                id="upload-quality"
                type="range"
                min="1"
                max="100"
                value={options.quality}
                disabled={disabled}
                onChange={(e) => onChange({ quality: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="upload-maxwidth">
                Max Width
              </label>
              <div className={styles.inputGroup}>
                <input
                  id="upload-maxwidth"
                  className="nb-input"
                  type="number"
                  value={options.maxWidth}
                  step="128"
                  min="128"
                  max="8192"
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ maxWidth: parseInt(e.target.value, 10) || 2048 })
                  }
                />
                <span className={styles.suffix}>px</span>
              </div>
            </div>
          </>
        )}

        <label className="nb-checkbox">
          <input
            type="checkbox"
            checked={options.removeBg}
            disabled={disabled}
            onChange={(e) => onChange({ removeBg: e.target.checked })}
          />
          Remove Background
        </label>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="upload-folder">
            Folder
          </label>
          <div className={styles.inputGroup}>
            <span className={styles.prefix}>/</span>
            <input
              id="upload-folder"
              className="nb-input"
              type="text"
              value={options.folder === '/' ? '' : options.folder.replace(/^\/+/, '')}
              placeholder="folder/path"
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  folder: e.target.value
                    ? `/${e.target.value.replace(/^\/+|\/+$/g, '')}`
                    : '/',
                })
              }
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="upload-tags">
            Tags
          </label>
          <input
            id="upload-tags"
            className="nb-input"
            type="text"
            value={options.tags}
            placeholder="comma, separated, tags"
            disabled={disabled}
            onChange={(e) => onChange({ tags: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
