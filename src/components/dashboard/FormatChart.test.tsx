import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormatChart } from './FormatChart';

describe('FormatChart', () => {
  it('returns null when there is no data', () => {
    const { container } = render(<FormatChart data={{}} total={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a row per format with label and percent', () => {
    render(<FormatChart data={{ webp: 50, jpeg: 50 }} total={100} />);
    expect(screen.getByText('WEBP')).toBeInTheDocument();
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });

  it('sorts formats by count descending', () => {
    const { container } = render(
      <FormatChart data={{ png: 10, webp: 90, jpeg: 5 }} total={105} />
    );
    const labels = Array.from(container.querySelectorAll('span')).map(
      (el) => el.textContent
    );
    const webpIdx = labels.indexOf('WEBP');
    const jpegIdx = labels.indexOf('JPEG');
    const pngIdx = labels.indexOf('PNG');
    expect(webpIdx).toBeGreaterThan(-1);
    expect(webpIdx).toBeLessThan(pngIdx);
    expect(pngIdx).toBeLessThan(jpegIdx);
  });

  it('shows 100% when a single format holds everything', () => {
    render(<FormatChart data={{ svg: 3 }} total={3} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
