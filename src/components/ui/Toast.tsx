'use client';

import { useEffect, useState } from 'react';
import type { ToastData } from '@/types';
import styles from './Toast.module.css';

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [leaving, setLeaving] = useState(false);

  // Start exit animation just before the auto-dismiss timer fires
  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const t = setTimeout(() => setLeaving(true), Math.max(duration - 200, 0));
    return () => clearTimeout(t);
  }, [toast.duration]);

  // Finish removal after the exit animation
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => onDismiss(toast.id), 200);
    return () => clearTimeout(t);
  }, [leaving, toast.id, onDismiss]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]} ${leaving ? styles.leaving : ''}`}
      role="status"
    >
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setLeaving(true)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
