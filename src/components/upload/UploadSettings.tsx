'use client';

import { CompressionSelector } from './CompressionSelector';
import type { UploadState } from '@/types';
import styles from './UploadSettings.module.css';

interface UploadSettingsProps {
  options: UploadState['globalOptions'];
  presets?: Array<{ id: string; name: string; unsigned: boolean }>;
  selectedPreset?: string;
  onPresetChange?: (name: string) => void;
  onChange: (options: Partial<UploadState['globalOptions']>) => void;
  disabled?: boolean;
}

export function UploadSettings({
  options,
  presets = [],
  selectedPreset,
  onPresetChange,
  onChange,
  disabled,
}: UploadSettingsProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Upload Options</h2>
      {presets.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="upload-preset">Upload Preset</label>
          <select
            id="upload-preset"
            className="nb-select"
            value={selectedPreset ?? ''}
            disabled={disabled}
            onChange={(event) => onPresetChange?.(event.target.value)}
          >
            <option value="">Manual settings</option>
            {presets.filter((preset) => preset.unsigned).map((preset) => (
              <option key={preset.id} value={preset.name}>{preset.name}</option>
            ))}
          </select>
        </div>
      )}
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

        <label className="nb-checkbox">
          <input
            type="checkbox"
            checked={options.removeBg}
            disabled={disabled}
            onChange={(e) => onChange({ removeBg: e.target.checked })}
          />
          Remove Background
        </label>

        {options.compress && (
          <>
            <CompressionSelector
              idPrefix="upload"
              quality={options.quality}
              disabled={disabled}
              onChange={(quality) => onChange({ quality })}
            />

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
