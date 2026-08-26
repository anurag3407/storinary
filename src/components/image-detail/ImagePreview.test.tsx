import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImagePreview } from './ImagePreview';
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
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('ImagePreview', () => {
  it('renders the image with alt text and dimensions', () => {
    render(<ImagePreview image={image} />);
    expect(screen.getByAltText('Hero image')).toHaveAttribute(
      'src',
      'https://cdn.example/hero.webp'
    );
    expect(screen.getByText('800 × 600')).toBeInTheDocument();
    expect(screen.getByText('WEBP')).toBeInTheDocument();
  });

  it('uses the transformed src when provided', () => {
    render(<ImagePreview image={image} transformedSrc="/api/transform?w=100" />);
    expect(screen.getByAltText('Hero image')).toHaveAttribute(
      'src',
      '/api/transform?w=100'
    );
    expect(screen.getByText(/Transformed preview/)).toBeInTheDocument();
  });

  it('shows original hint by default', () => {
    render(<ImagePreview image={image} />);
    expect(screen.getByText(/Original · click to zoom/)).toBeInTheDocument();
  });

  it('toggles zoom on click', () => {
    const { container } = render(<ImagePreview image={image} />);
    const viewport = container.querySelector('[class*="viewport"]') as HTMLElement;
    expect(viewport.className).not.toContain('zoomed');

    fireEvent.click(viewport);
    expect(viewport.className).toContain('zoomed');
  });
});
