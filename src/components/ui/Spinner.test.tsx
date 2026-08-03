import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders a status role with a loading label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('applies the size class', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole('status').className).toContain('lg');
  });

  it('defaults to md size', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').className).toContain('md');
  });
});
