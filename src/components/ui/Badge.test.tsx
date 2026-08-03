import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Connected</Badge>);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('uses the default variant by default', () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText('Tag').className).toContain('default');
  });

  it.each(['success', 'danger', 'info', 'warning'] as const)(
    'applies the %s variant class',
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant).className).toContain(variant);
    }
  );
});
