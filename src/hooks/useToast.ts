'use client';

import { useContext } from 'react';
import { ToastContext } from '@/components/ui/ToastProvider';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');

  return {
    toast: {
      success: (message: string) => context.addToast({ message, type: 'success' }),
      error: (message: string) => context.addToast({ message, type: 'error' }),
      info: (message: string) => context.addToast({ message, type: 'info' }),
      warning: (message: string) => context.addToast({ message, type: 'warning' }),
    },
  };
}
