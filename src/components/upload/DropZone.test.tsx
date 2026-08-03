import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { DropZone } from './DropZone';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('DropZone', () => {
  it('renders the drop instructions', () => {
    render(<DropZone onFilesAdded={vi.fn()} />, { wrapper });
    expect(screen.getByText(/Drag & drop images here/)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/)).toBeInTheDocument();
  });

  it('adds valid files through the hidden input', () => {
    const onFilesAdded = vi.fn();
    render(<DropZone onFilesAdded={onFilesAdded} />, { wrapper });

    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, { target: { files: [png] } });
    expect(onFilesAdded).toHaveBeenCalledWith([png]);
  });

  it('rejects unsupported files and reports via toast', () => {
    const onFilesAdded = vi.fn();
    render(<DropZone onFilesAdded={onFilesAdded} />, { wrapper });

    const zip = new File(['x'], 'a.zip', { type: 'application/zip' });
    const input = document.querySelector('input[type="file"]');

    fireEvent.change(input as HTMLInputElement, { target: { files: [zip] } });
    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(screen.getByText(/Unsupported format/)).toBeInTheDocument();
  });

  it('handles drops with valid files', () => {
    const onFilesAdded = vi.fn();
    render(<DropZone onFilesAdded={onFilesAdded} />, { wrapper });

    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const zone = screen.getByText(/Drag & drop images here/).closest('div')!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [png] },
    });

    expect(onFilesAdded).toHaveBeenCalledWith([png]);
  });
});
