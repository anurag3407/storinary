import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryToolbar } from './GalleryToolbar';
import type { ImagesListParams } from '@/types';

const filters: ImagesListParams = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
  metadata: '',
};

const baseProps = {
  filters,
  setFilters: vi.fn(),
  selectedCount: 0,
  totalCount: 10,
  folders: ['/'],
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  onBulkDelete: vi.fn(),
  onBulkCopy: vi.fn(),
  onBulkDownload: vi.fn(),
  metadataFields: [{
    id: 'field-1', externalId: 'campaign', label: 'Campaign',
    type: 'enum' as const, required: false, allowedValues: ['spring'], active: true,
  }],
};

describe('GalleryToolbar metadata filters', () => {
  it('encodes enum selections into the metadata query', () => {
    const setFilters = vi.fn();
    render(<GalleryToolbar {...baseProps} setFilters={setFilters} />);

    fireEvent.change(screen.getByLabelText('Filter by Campaign'), {
      target: { value: 'spring' },
    });

    expect(setFilters).toHaveBeenCalledWith({
      metadata: 'campaign=spring',
      page: 1,
    });
  });
});
