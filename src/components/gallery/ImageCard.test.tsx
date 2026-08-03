import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImageCard } from './ImageCard';
import type { ImageRecord } from '@/types';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const image: ImageRecord = {
  id: 'img-1',
  originalName: 'hero.webp',
  storagePath: '2024/01/hero-abc.webp',
  publicUrl: 'https://cdn.example/hero.webp',
  width: 800,
  height: 600,
  fileSize: 20480,
  format: 'webp',
  mimeType: 'image/webp',
  folder: '/',
  tags: '',
  altText: 'Hero image',
  bgRemoved: false,
  compressed: true,
  createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
};

const baseProps = {
  image,
  isSelected: false,
  onToggleSelect: vi.fn(),
  onDelete: vi.fn(),
  onCopyUrl: vi.fn(),
};

describe('ImageCard', () => {
  beforeEach(() => {
    pushMock.mockReset();
    baseProps.onToggleSelect.mockReset();
    baseProps.onDelete.mockReset();
    baseProps.onCopyUrl.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders filename, size, format, and select checkbox', () => {
    render(<ImageCard {...baseProps} />);
    expect(screen.getByText('hero.webp')).toBeInTheDocument();
    expect(screen.getByText(/20 KB/)).toBeInTheDocument();
    expect(screen.getByText('WEBP')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Select hero.webp' })
    ).not.toBeChecked();
  });

  it('renders an optimized thumbnail via the transform endpoint', () => {
    render(<ImageCard {...baseProps} />);
    const img = screen.getByAltText('Hero image') as HTMLImageElement;
    expect(img.src).toContain('/api/serve/2024/01/hero-abc.webp?w=400');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('marks the card as selected', () => {
    render(<ImageCard {...baseProps} isSelected />);
    expect(
      screen.getByRole('checkbox', { name: 'Select hero.webp' })
    ).toBeChecked();
  });

  it('toggles selection without navigating', () => {
    render(<ImageCard {...baseProps} />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select hero.webp' })
    );
    expect(baseProps.onToggleSelect).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('navigates to detail on card click', () => {
    render(<ImageCard {...baseProps} />);
    const card = screen.getByRole('link', { name: /hero.webp/ });
    fireEvent.click(card);
    expect(pushMock).toHaveBeenCalledWith('/images/img-1');
  });

  it('navigates to detail on Enter key', () => {
    render(<ImageCard {...baseProps} />);
    const card = screen.getByRole('link', { name: /hero.webp/ });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/images/img-1');
  });

  it('copies the URL from the copy button', () => {
    render(<ImageCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(baseProps.onCopyUrl).toHaveBeenCalledTimes(1);
  });

  it('deletes after confirmation', () => {
    render(<ImageCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(window.confirm).toHaveBeenCalledWith(
      'Delete "hero.webp"? This cannot be undone.'
    );
    expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('skips deletion when confirmation is declined', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<ImageCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(baseProps.onDelete).not.toHaveBeenCalled();
  });
});
