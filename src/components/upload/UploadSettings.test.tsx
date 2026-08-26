import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UploadSettings } from './UploadSettings';
import type { UploadState } from '@/types';

const options: UploadState['globalOptions'] = {
  removeBg: false,
  compress: true,
  quality: 80,
  maxWidth: 2048,
  folder: '/',
  tags: '',
  moderate: false,
};

describe('UploadSettings', () => {
  it('renders compression and bg removal toggles', () => {
    render(<UploadSettings options={options} onChange={vi.fn()} />);
    expect(
      screen.getByRole('checkbox', { name: /Compress to WebP/ })
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Remove Background/ })
    ).not.toBeChecked();
  });

  it('shows quality and max width controls when compression is on', () => {
    render(<UploadSettings options={options} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Quality:/)).toBeInTheDocument();
    expect(screen.getByLabelText('Max Width')).toBeInTheDocument();
  });

  it('hides quality controls when compression is off', () => {
    render(
      <UploadSettings
        options={{ ...options, compress: false }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/Quality:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Max Width')).not.toBeInTheDocument();
  });

  it('notifies change when toggling compression', () => {
    const onChange = vi.fn();
    render(<UploadSettings options={options} onChange={onChange} />);

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Compress to WebP/ })
    );
    expect(onChange).toHaveBeenCalledWith({ compress: false });
  });

  it('normalizes the folder input to a leading-slash path', () => {
    const onChange = vi.fn();
    render(<UploadSettings options={options} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Folder'), {
      target: { value: 'products' },
    });
    expect(onChange).toHaveBeenCalledWith({ folder: '/products' });
  });

  it('updates tags', () => {
    const onChange = vi.fn();
    render(<UploadSettings options={options} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Tags'), {
      target: { value: 'hero' },
    });
    expect(onChange).toHaveBeenCalledWith({ tags: 'hero' });
  });
});
