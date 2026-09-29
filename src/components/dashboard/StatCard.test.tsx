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

  it('applies the default accent to the card', () => {
    const { container } = render(<StatCard label="X" value={1} icon="📷" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.getPropertyValue('--stat-accent')).toBe('var(--ui-chart-1)');
  });

  it('applies a custom accent to the card', () => {
    const { container } = render(
      <StatCard label="X" value={1} icon="💾" color="var(--ui-chart-3)" />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.getPropertyValue('--stat-accent')).toBe('var(--ui-chart-3)');
  });

  it('renders the sub badge when provided', () => {
    render(<StatCard label="X" value={1} icon="📷" sub="12% of quota" />);
    expect(screen.getByText('12% of quota')).toBeInTheDocument();
  });
});
