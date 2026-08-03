import type { BadgeProps } from '@/types';
import styles from './Badge.module.css';

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
