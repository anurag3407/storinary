import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hi">
        content
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Delete?">
        Are you sure?
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hi" actions={<button>OK</button>}>
        body
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>
    );
    await userEvent.click(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('closes when clicking the overlay', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>
    );
    const overlay = document.querySelector('[class*="overlay"]');
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>
    );
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog and restores it to the trigger on close', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Hi">
            body
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
