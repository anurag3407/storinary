'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ModalProps } from '@/types';
import styles from './Modal.module.css';
import { CloseIcon } from '@/components/ui/icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the effect every render, so a
  // changing inline callback can't steal focus or thrash the scroll lock.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog unless a child already claimed it (autoFocus).
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const target = dialog.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <CloseIcon size={16} />
        </button>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
