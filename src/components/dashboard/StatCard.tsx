import type { CSSProperties } from 'react';
import type { StatCardProps } from '@/types';
import styles from './StatCard.module.css';

export function StatCard({
  label,
  value,
  icon,
  color = 'var(--ui-chart-1)',
  sub,
}: StatCardProps) {
  // One accent token drives the icon chip, hover edge and top rule,
  // so callers only ever pass a colour — never a tint ladder.
  const accentStyle = { '--stat-accent': color } as CSSProperties;

  return (
    <div className={styles.card} style={accentStyle}>
      <div className={styles.topRow}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        {sub && <span className={styles.subBadge}>{sub}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
