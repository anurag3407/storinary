import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { useToast } from './useToast';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('throws when used outside ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within ToastProvider'
    );
  });

  it('success() shows a toast with the message', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper });
    act(() => result.current.toast.success('Upload complete'));
    expect(screen.getByText('Upload complete')).toBeInTheDocument();
  });

  it('error() and info() render their variants', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper });
    act(() => {
      result.current.toast.error('Something broke');
      result.current.toast.info('Heads up');
    });
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper });
    act(() => {
      result.current.toast.success('One');
      result.current.toast.success('Two');
    });
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('auto-dismisses after the default duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper });
    act(() => result.current.toast.success('Temp message'));
    expect(screen.getByText('Temp message')).toBeInTheDocument();

    // Provider removes after 4000ms; Toast exit animation needs +200ms
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Temp message')).not.toBeInTheDocument();
  });

  it('dismisses a toast when its dismiss button is clicked', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper });
    act(() => result.current.toast.success('Dismiss me'));

    const toastEl = screen.getByText('Dismiss me').closest('[role="status"]');
    expect(toastEl).not.toBeNull();

    fireEvent.click(
      toastEl!.querySelector('button[aria-label="Dismiss notification"]')!
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('does not render a toast outside a mounted provider (render sanity)', () => {
    render(<ToastProvider>child</ToastProvider>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
