import type { StatCardProps } from '@/types';
import styles from './StatCard.module.css';

export function StatCard({
  label,
  value,
  icon,
  color = 'var(--nb-yellow)',
}: StatCardProps) {
  return (
    <div className={styles.card} style={{ backgroundColor: color }}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
