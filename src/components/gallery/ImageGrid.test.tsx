import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImageGrid } from './ImageGrid';
import type { ImageRecord } from '@/types';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function makeImage(id: string): ImageRecord {
  return {
    id,
    originalName: `${id}.webp`,
    storagePath: `2024/01/${id}.webp`,
    publicUrl: `https://cdn.example/${id}.webp`,
    width: 100,
    height: 100,
    fileSize: 1024,
    format: 'webp',
    mimeType: 'image/webp',
    folder: '/',
    tags: '',
    altText: '',
    bgRemoved: false,
    aiModerated: false,
    aiModerationScore: null,
    compressed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('ImageGrid', () => {
  const onToggleSelect = vi.fn();
  const onDelete = vi.fn();
  const onCopyUrl = vi.fn();

  beforeEach(() => {
    onToggleSelect.mockReset();
    onDelete.mockReset();
    onCopyUrl.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders a card per image', () => {
    render(
      <ImageGrid
        images={[makeImage('a'), makeImage('b')]}
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
        onCopyUrl={onCopyUrl}
      />
    );
    expect(screen.getByText('a.webp')).toBeInTheDocument();
    expect(screen.getByText('b.webp')).toBeInTheDocument();
  });

  it('passes selection state per image', () => {
    render(
      <ImageGrid
        images={[makeImage('a'), makeImage('b')]}
        selectedIds={new Set(['a'])}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
        onCopyUrl={onCopyUrl}
      />
    );
    expect(screen.getByRole('checkbox', { name: 'Select a.webp' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Select b.webp' })
    ).not.toBeChecked();
  });

  it('forwards selection toggles with the image id', () => {
    render(
      <ImageGrid
        images={[makeImage('a')]}
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
        onCopyUrl={onCopyUrl}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select a.webp' }));
    expect(onToggleSelect).toHaveBeenCalledWith('a');
  });
});
