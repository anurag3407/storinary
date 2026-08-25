import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompressionSelector } from './CompressionSelector';

describe('CompressionSelector', () => {
  it('renders all compression preset options', () => {
    render(<CompressionSelector quality={80} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /Extreme/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Recommended/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Low Compression/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
  });

  it('marks Recommended as active when quality is 80', () => {
    render(<CompressionSelector quality={80} onChange={vi.fn()} />);

    const rec = screen.getByRole('radio', { name: /Recommended/ });
    expect(rec).toHaveAttribute('aria-checked', 'true');

    const ext = screen.getByRole('radio', { name: /Extreme/ });
    expect(ext).toHaveAttribute('aria-checked', 'false');
  });

  it('marks Extreme as active when quality is 50', () => {
    render(<CompressionSelector quality={50} onChange={vi.fn()} />);

    const ext = screen.getByRole('radio', { name: /Extreme/ });
    expect(ext).toHaveAttribute('aria-checked', 'true');
  });

  it('marks Custom as active when quality is a non-preset value (e.g. 65)', () => {
    render(<CompressionSelector quality={65} onChange={vi.fn()} />);

    const custom = screen.getByRole('radio', { name: /Custom/ });
    expect(custom).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with 50 when Extreme preset is clicked', () => {
    const onChange = vi.fn();
    render(<CompressionSelector quality={80} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: /Extreme/ }));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('calls onChange with 92 when Low Compression preset is clicked', () => {
    const onChange = vi.fn();
    render(<CompressionSelector quality={80} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: /Low Compression/ }));
    expect(onChange).toHaveBeenCalledWith(92);
  });

  it('calls onChange with slider input value', () => {
    const onChange = vi.fn();
    render(<CompressionSelector quality={80} onChange={onChange} idPrefix="test" />);

    const slider = screen.getByLabelText(/Quality:/);
    fireEvent.change(slider, { target: { value: '45' } });

    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('calls onChange with direct numeric input value', () => {
    const onChange = vi.fn();
    render(<CompressionSelector quality={80} onChange={onChange} />);

    const numberInput = screen.getByLabelText('Compression quality percentage');
    fireEvent.change(numberInput, { target: { value: '70' } });

    expect(onChange).toHaveBeenCalledWith(70);
  });

  it('does not trigger onChange when disabled and preset is clicked', () => {
    const onChange = vi.fn();
    render(<CompressionSelector quality={80} onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole('radio', { name: /Extreme/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
