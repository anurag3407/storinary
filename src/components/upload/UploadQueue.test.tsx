import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { UploadQueue } from './UploadQueue';
import type { UploadItem as UploadItemType } from '@/types';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function makeItem(id: string): UploadItemType {
  return {
    id,
    file: new File(['x'], `${id}.png`, { type: 'image/png' }),
    previewUrl: 'blob:preview',
    status: 'pending',
    progress: 0,
    options: { removeBg: false, compress: true, folder: '/', tags: '' },
  };
}

describe('UploadQueue', () => {
  it('renders nothing when the queue is empty', () => {
    render(<UploadQueue items={[]} onRemove={vi.fn()} />, {
      wrapper,
    });
    expect(screen.queryByText('Upload Queue')).not.toBeInTheDocument();
  });

  it('shows the queue header with the item count', () => {
    render(<UploadQueue items={[makeItem('a')]} onRemove={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('Upload Queue')).toBeInTheDocument();
    expect(screen.getByText('1 file in queue')).toBeInTheDocument();
  });

  it('renders each item in the queue', () => {
    render(
      <UploadQueue items={[makeItem('a'), makeItem('b')]} onRemove={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
    expect(screen.getByText('2 files in queue')).toBeInTheDocument();
  });

  it('pluralizes the count for a single item', () => {
    render(<UploadQueue items={[makeItem('a')]} onRemove={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('1 file in queue')).toBeInTheDocument();
  });
});
