import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

describe('Header', () => {
  it('renders title and description', () => {
    render(<Header title="Gallery" description="All your images" />);
    expect(
      screen.getByRole('heading', { name: 'Gallery' })
    ).toBeInTheDocument();
    expect(screen.getByText('All your images')).toBeInTheDocument();
  });

  it('renders the actions slot', () => {
    render(<Header title="Upload" actions={<button>Go</button>} />);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('omits description when not provided', () => {
    render(<Header title="Upload" />);
    expect(screen.queryByText('All your images')).not.toBeInTheDocument();
  });

  it('dispatches a sidebar toggle event from the hamburger', async () => {
    const dispatchSpy = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation(() => true);

    render(<Header title="Dashboard" />);
    await userEvent.click(screen.getByLabelText('Toggle navigation sidebar'));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'storinary:toggle-sidebar' })
    );
    dispatchSpy.mockRestore();
  });
});
