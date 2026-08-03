import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const makeToast = (overrides: Partial<Parameters<typeof Toast>[0]['toast']> = {}) => ({
    id: 't1',
    message: 'Saved',
    type: 'success' as const,
    duration: 4000,
    ...overrides,
  });

  it('renders the message with a status role', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('applies the type class', () => {
    render(<Toast toast={makeToast({ type: 'error' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status').className).toContain('error');
  });

  it('dismisses after the default duration', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />);

    // Leaving state begins 200ms before the duration ends
    act(() => {
      vi.advanceTimersByTime(3800);
    });
    // Exit animation finishes → onDismiss fires
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('dismisses immediately via the dismiss button', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledWith('t1');
  });
});
