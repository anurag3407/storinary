'use client';

import type { ButtonProps } from '@/types';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  loading,
  type = 'button',
  fullWidth,
  icon,
  className,
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? <Spinner size="sm" /> : icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
