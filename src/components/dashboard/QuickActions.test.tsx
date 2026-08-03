import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickActions } from './QuickActions';

describe('QuickActions', () => {
  it('renders links to upload, gallery, and settings', () => {
    render(<QuickActions />);

    expect(screen.getByText('Upload Images').closest('a')).toHaveAttribute(
      'href',
      '/upload'
    );
    expect(screen.getByText('Browse Gallery').closest('a')).toHaveAttribute(
      'href',
      '/gallery'
    );
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute(
      'href',
      '/settings'
    );
  });
});
