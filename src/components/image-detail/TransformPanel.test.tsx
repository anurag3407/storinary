import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TransformPanel } from './TransformPanel';
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

describe('TransformPanel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders controls and presets', () => {
    render(<TransformPanel image={image} />);
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.getByLabelText(/Quality:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /150×150 Thumb/ })).toBeInTheDocument();
  });

  it('debounces transform updates after a preset click', () => {
    const onTransformChange = vi.fn();
    render(<TransformPanel image={image} onTransformChange={onTransformChange} />);

    fireEvent.click(screen.getByRole('button', { name: /800×600 Medium/ }));

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onTransformChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTransformChange).toHaveBeenCalledWith({
      w: 800,
      h: 600,
      fit: 'inside',
    });
  });

  it('resets the transform to empty params', () => {
    const onTransformChange = vi.fn();
    render(<TransformPanel image={image} onTransformChange={onTransformChange} />);

    fireEvent.click(screen.getByRole('button', { name: /150×150 Thumb/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onTransformChange).toHaveBeenCalledWith({});
  });

  it('updates width from the input', () => {
    const onTransformChange = vi.fn();
    render(<TransformPanel image={image} onTransformChange={onTransformChange} />);

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '400' } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({ w: 400 })
    );
  });
});
