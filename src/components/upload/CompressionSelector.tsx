'use client';

import React, { useMemo } from 'react';
import styles from './CompressionSelector.module.css';

export interface CompressionSelectorProps {
  quality: number;
  onChange: (quality: number) => void;
  disabled?: boolean;
  idPrefix?: string;
}

type PresetType = 'extreme' | 'recommended' | 'low' | 'custom';

interface PresetConfig {
  id: PresetType;
  title: string;
  badge: string;
  quality: number;
  reductionLabel: string;
  description: string;
  icon: string;
}

const PRESETS: PresetConfig[] = [
  {
    id: 'extreme',
    title: 'Extreme',
    badge: 'High Compression',
    quality: 50,
    reductionLabel: '~60-80% smaller',
    description: 'Maximum compression, lower image fidelity',
    icon: '⚡',
  },
  {
    id: 'recommended',
    title: 'Recommended',
    badge: 'Good Quality',
    quality: 80,
    reductionLabel: '~40-60% smaller',
    description: 'Best balance of image quality and compression',
    icon: '⭐',
  },
  {
    id: 'low',
    title: 'Low Compression',
    badge: 'High Quality',
    quality: 92,
    reductionLabel: '~15-30% smaller',
    description: 'Light compression, preserves crisp details',
    icon: '💎',
  },
  {
    id: 'custom',
    title: 'Custom',
    badge: 'Manual %',
    quality: 0,
    reductionLabel: 'Variable size',
    description: 'Select your exact compression percentage',
    icon: '⚙️',
  },
];

export function CompressionSelector({
  quality,
  onChange,
  disabled = false,
  idPrefix = 'upload',
}: CompressionSelectorProps) {
  // Determine active preset based on current quality
  const activePreset: PresetType = useMemo(() => {
    if (quality === 50) return 'extreme';
    if (quality === 80) return 'recommended';
    if (quality === 92) return 'low';
    return 'custom';
  }, [quality]);

  // Handle preset selection
  const handleSelectPreset = (preset: PresetConfig) => {
    if (disabled) return;
    if (preset.id === 'custom') {
      // Keep current quality
      return;
    }
    onChange(preset.quality);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      onChange(Math.min(100, Math.max(1, val)));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      onChange(Math.min(100, Math.max(1, val)));
    }
  };

  // Helper for visual feedback text
  const feedback = useMemo(() => {
    const compressionLevel = 100 - quality;
    if (quality <= 60) {
      return {
        tier: 'High Compression',
        colorClass: styles.tierHigh,
        desc: `High compression (~${compressionLevel}%). Smallest file size, best for speed & thumbnails.`,
      };
    }
    if (quality <= 85) {
      return {
        tier: 'Balanced / Recommended',
        colorClass: styles.tierBalanced,
        desc: `Recommended compression (~${compressionLevel}%). Great balance between quality & size.`,
      };
    }
    return {
      tier: 'High Fidelity / Low Compression',
      colorClass: styles.tierLow,
      desc: `Light compression (~${compressionLevel}%). High quality with maximum detail.`,
    };
  }, [quality]);

  const inputId = `${idPrefix}-quality`;
  const numberId = `${idPrefix}-quality-number`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitleRow}>
          <span className={styles.sectionLabel}>Compression Level</span>
          <span className={`${styles.statusBadge} ${feedback.colorClass}`}>
            {feedback.tier} • {quality}% Quality
          </span>
        </div>
        <p className={styles.sectionSubtitle}>
          Choose a preset like in iLovePDF or dial a custom compression percentage.
        </p>
      </div>

      {/* Preset Cards */}
      <div className={styles.presetGrid} role="radiogroup" aria-label="Compression Presets">
        {PRESETS.map((preset) => {
          const isSelected =
            preset.id === 'custom'
              ? activePreset === 'custom'
              : quality === preset.quality;

          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              className={`${styles.presetCard} ${
                isSelected ? styles.presetCardActive : ''
              }`}
              onClick={() => handleSelectPreset(preset)}
            >
              <div className={styles.presetTop}>
                <span className={styles.presetIcon}>{preset.icon}</span>
                <span className={styles.presetTitle}>{preset.title}</span>
              </div>
              <span className={styles.presetReduction}>
                {preset.id === 'custom' ? `${quality}% Quality` : preset.reductionLabel}
              </span>
              <span className={styles.presetDesc}>{preset.description}</span>
            </button>
          );
        })}
      </div>

      {/* Custom Slider & Number Input */}
      <div className={styles.sliderSection}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor={inputId}>
            Quality: {quality}%
          </label>
          <div className={styles.numericInputWrap}>
            <span className={styles.reductionPill}>
              ~{100 - quality}% Compression
            </span>
            <input
              id={numberId}
              type="number"
              min="1"
              max="100"
              value={quality}
              disabled={disabled}
              className={`nb-input ${styles.numberInput}`}
              onChange={handleNumberChange}
              aria-label="Compression quality percentage"
            />
            <span className={styles.percentSymbol}>%</span>
          </div>
        </div>

        <div className={styles.sliderControl}>
          <input
            id={inputId}
            type="range"
            min="1"
            max="100"
            step="1"
            value={quality}
            disabled={disabled}
            className={styles.rangeInput}
            onChange={handleSliderChange}
          />
          <div className={styles.sliderLabels}>
            <span>1% (Max Compress)</span>
            <span>50%</span>
            <span>80% (Sweet spot)</span>
            <span>100% (Lossless)</span>
          </div>
        </div>

        <div className={styles.hintBox}>
          <span className={styles.hintIcon}>💡</span>
          <span className={styles.hintText}>{feedback.desc}</span>
        </div>
      </div>
    </div>
  );
}
