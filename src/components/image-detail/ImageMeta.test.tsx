import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ImageMeta } from './ImageMeta';
import type { ImageRecord } from '@/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
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
  tags: 'hero,banner',
  altText: 'Hero image',
  bgRemoved: true,
  compressed: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('ImageMeta', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders the metadata table', () => {
    render(<ImageMeta image={image} />, { wrapper });
    expect(screen.getByText('hero.webp')).toBeInTheDocument();
    expect(screen.getByText('800 × 600 px')).toBeInTheDocument();
    expect(screen.getByText('WEBP')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders tags as badges', () => {
    render(<ImageMeta image={image} />, { wrapper });
    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('banner')).toBeInTheDocument();
  });

  it('edits and saves a field via PATCH', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<ImageMeta image={image} />, { wrapper });

    fireEvent.click(screen.getByLabelText('Edit Alt Text'));
    const input = screen.getByPlaceholderText('Alt Text');
    fireEvent.change(input, { target: { value: 'New alt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/images/img-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ altText: 'New alt' });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows an error toast when saving fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<ImageMeta image={image} />, { wrapper });

    fireEvent.click(screen.getByLabelText('Edit Folder'));
    const input = screen.getByPlaceholderText('Folder');
    fireEvent.change(input, { target: { value: '/new' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Failed to save changes')).toBeInTheDocument();
  });

  it('cancels editing on Escape', () => {
    render(<ImageMeta image={image} />, { wrapper });
    fireEvent.click(screen.getByLabelText('Edit Tags'));
    const input = screen.getByPlaceholderText('Tags');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Tags')).not.toBeInTheDocument();
  });
});
