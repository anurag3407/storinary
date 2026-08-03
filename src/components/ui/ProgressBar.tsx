import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ProgressBar({ value, color, size = 'md', showLabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${styles[size]}`} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={styles.fill}
          style={{
            width: `${clamped}%`,
            background: color || undefined,
            borderRight: clamped >= 100 ? 'none' : undefined,
          }}
        />
      </div>
      {showLabel && <span className={styles.label}>{Math.round(clamped)}%</span>}
    </div>
  );
}
