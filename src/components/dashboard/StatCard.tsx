import type { StatCardProps } from '@/types';
import styles from './StatCard.module.css';

export function StatCard({
  label,
  value,
  icon,
  color = 'var(--nb-yellow)',
  sub,
}: StatCardProps) {
  return (
    <div className={styles.card} style={{ backgroundColor: color }}>
      <div className={styles.topRow}>
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
        {sub && <span className={styles.subBadge}>{sub}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
