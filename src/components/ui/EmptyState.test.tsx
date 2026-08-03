import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, and description', () => {
    render(
      <EmptyState icon="🔍" title="Not Found" description="Nothing here." />
    );
    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not Found' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('renders the action node', () => {
    render(
      <EmptyState
        icon="⚠️"
        title="Error"
        description="Try again."
        action={<button>Retry</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('omits the action slot when not provided', () => {
    render(<EmptyState icon="✓" title="Done" description="All good." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
