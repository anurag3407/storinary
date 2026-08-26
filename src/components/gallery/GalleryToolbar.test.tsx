import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryToolbar } from './GalleryToolbar';
import type { ImagesListParams } from '@/types';

const filters: ImagesListParams = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

const baseProps = {
  filters,
  setFilters: vi.fn(),
  selectedCount: 0,
  totalCount: 42,
  folders: ['/', '/pets'],
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  onBulkDelete: vi.fn(),
  onBulkCopy: vi.fn(),
  onBulkDownload: vi.fn(),
};

describe('GalleryToolbar', () => {
  it('updates the search filter', () => {
    render(<GalleryToolbar {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search images...'), {
      target: { value: 'cat' },
    });
    expect(baseProps.setFilters).toHaveBeenCalledWith({ search: 'cat' });
  });

  it('renders folder options and updates the folder filter', () => {
    render(<GalleryToolbar {...baseProps} />);
    expect(screen.getByRole('option', { name: 'Root (/)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '/pets' })).toBeInTheDocument();

    // First combobox is the folder select, second is the sort select
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: '/pets' },
    });
    expect(baseProps.setFilters).toHaveBeenCalledWith({ folder: '/pets' });
  });

  it('toggles the sort order', () => {
    render(<GalleryToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Newest/ }));
    expect(baseProps.setFilters).toHaveBeenCalledWith({ order: 'asc' });
  });

  it('shows bulk actions only when items are selected', () => {
    const { unmount } = render(<GalleryToolbar {...baseProps} />);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    unmount();
    render(<GalleryToolbar {...baseProps} selectedCount={3} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Download ZIP/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Delete Selected/ })
    ).toBeInTheDocument();
  });

  it('selects all via the toolbar checkbox', () => {
    render(<GalleryToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Select All/ }));
    expect(baseProps.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('shows the range of displayed items', () => {
    render(<GalleryToolbar {...baseProps} />);
    expect(screen.getByText(/Showing 1-20 of 42/)).toBeInTheDocument();
  });
});
