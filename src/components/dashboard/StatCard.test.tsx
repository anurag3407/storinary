import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label, value, and icon', () => {
    render(<StatCard label="Total Images" value={42} icon="📷" />);
    expect(screen.getByText('📷')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Images')).toBeInTheDocument();
  });

  it('applies the default color to the card', () => {
    const { container } = render(<StatCard label="X" value={1} icon="📷" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: 'var(--nb-yellow)' });
  });

  it('applies a custom color to the card', () => {
    const { container } = render(
      <StatCard label="X" value={1} icon="💾" color="var(--nb-blue)" />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: 'var(--nb-blue)' });
  });
});
