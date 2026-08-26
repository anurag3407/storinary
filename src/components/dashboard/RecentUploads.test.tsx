import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentUploads } from './RecentUploads';
import type { ImageRecord } from '@/types';

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
  aiModerated: false,
  aiModerationScore: null,
  compressed: true,
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
};

describe('RecentUploads', () => {
  it('shows an empty message when there are no images', () => {
    render(<RecentUploads images={[]} />);
    expect(screen.getByText('No images uploaded yet.')).toBeInTheDocument();
  });

  it('renders image rows with filename and size', () => {
    render(<RecentUploads images={[image]} />);
    expect(screen.getByText('hero.webp')).toBeInTheDocument();
    expect(screen.getByText(/20 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1h ago/)).toBeInTheDocument();
  });

  it('links each row to the image detail page', () => {
    render(<RecentUploads images={[image]} />);
    const link = screen.getByLabelText('View hero.webp');
    expect(link).toHaveAttribute('href', '/images/img-1');
  });

  it('renders optimized thumbnails via the transform endpoint', () => {
    render(<RecentUploads images={[image]} />);
    const img = screen.getByAltText('Hero image');
    expect(img.getAttribute('src')).toContain(
      '/api/serve/2024/01/hero-abc.webp?w=96'
    );
  });
});
