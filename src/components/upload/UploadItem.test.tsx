import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { UploadItem } from './UploadItem';
import type { UploadItem as UploadItemType } from '@/types';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function makeItem(overrides: Partial<UploadItemType> = {}): UploadItemType {
  return {
    id: 'u1',
    file: new File(['x'], 'photo.png', { type: 'image/png' }),
    previewUrl: 'blob:preview',
    status: 'pending',
    progress: 0,
    options: { removeBg: false, compress: true, folder: '/', tags: '' },
    ...overrides,
  };
}

describe('UploadItem', () => {
  it('shows a pending badge for pending items', () => {
    render(<UploadItem item={makeItem()} onRemove={vi.fn()} />, { wrapper });
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows progress while uploading', () => {
    render(
      <UploadItem item={makeItem({ status: 'uploading', progress: 45 })} onRemove={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
  });

  it('shows a success badge and copy button when done', async () => {
    const item = makeItem({
      status: 'done',
      result: {
        id: 'img-1',
        originalName: 'photo.png',
        storagePath: '2024/01/photo-123.webp',
        publicUrl: 'https://cdn.example/photo-123.webp',
        width: 10,
        height: 10,
        fileSize: 100,
        format: 'webp',
        mimeType: 'image/webp',
        folder: '/',
        tags: '',
        altText: '',
        bgRemoved: false,
        compressed: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<UploadItem item={item} onRemove={vi.fn()} />, { wrapper });
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy URL/ })).toBeInTheDocument();
  });

  it('shows an error badge and the error message', () => {
    render(
      <UploadItem item={makeItem({ status: 'error', error: 'boom' })} onRemove={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('removes the item from the remove button', () => {
    const onRemove = vi.fn();
    render(<UploadItem item={makeItem()} onRemove={onRemove} />, { wrapper });
    fireEvent.click(screen.getByLabelText('Remove photo.png'));
    expect(onRemove).toHaveBeenCalledWith('u1');
  });
});
