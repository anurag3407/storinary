import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders a progressbar with aria values', () => {
    render(<ProgressBar value={42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps values above 100', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
  });

  it('clamps values below 0', () => {
    render(<ProgressBar value={-10} />);
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
  });

  it('shows a label when requested', () => {
    render(<ProgressBar value={37} showLabel />);
    expect(screen.getByText('37%')).toBeInTheDocument();
  });

  it('applies a custom color to the fill', () => {
    render(<ProgressBar value={50} color="red" />);
    const fill = document.querySelector('[style*="red"]');
    expect(fill).not.toBeNull();
  });
});
