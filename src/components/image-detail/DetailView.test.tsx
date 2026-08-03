import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { DetailView } from './DetailView';
import type { GeneratedLinks, ImageRecord } from '@/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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
  tags: 'hero',
  altText: 'Hero image',
  bgRemoved: false,
  compressed: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const links: GeneratedLinks = {
  direct: 'https://cdn.example/hero.webp',
  html: '<img src="https://cdn.example/hero.webp" alt="Hero image" />',
  markdown: '![Hero image](https://cdn.example/hero.webp)',
  css: "background-image: url('https://cdn.example/hero.webp');",
  transformBase: 'http://localhost:3000/api/serve/2024/01/hero-abc.webp',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('DetailView', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('renders preview, meta, transform, and link panels', () => {
    render(<DetailView image={image} links={links} />, { wrapper });
    expect(screen.getByAltText('Hero image')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
  });

  it('switches to a transformed preview when transform params change', () => {
    render(<DetailView image={image} links={links} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /150×150 Thumb/ }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByAltText('Hero image')).toHaveAttribute(
      'src',
      '/api/images/img-1/transform?w=150&h=150&fit=cover'
    );
    expect(screen.getByText(/Transformed preview/)).toBeInTheDocument();
    expect(screen.getByText('Transform URL')).toBeInTheDocument();
  });

  it('resets to the original preview', () => {
    render(<DetailView image={image} links={links} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /150×150 Thumb/ }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByAltText('Hero image')).toHaveAttribute(
      'src',
      'https://cdn.example/hero.webp'
    );
    expect(screen.queryByText('Transform URL')).not.toBeInTheDocument();
  });
});
