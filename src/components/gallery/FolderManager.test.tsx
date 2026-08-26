import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FolderManager } from './FolderManager';

const folders = [
  { path: '/', imageCount: 2, videoCount: 1 },
  { path: '/empty', imageCount: 0, videoCount: 0 },
];

const baseProps = {
  folders,
  isBusy: false,
  onSelectFolder: vi.fn(),
  onRenameFolder: vi.fn().mockResolvedValue(undefined),
  onDeleteFolder: vi.fn().mockResolvedValue(undefined),
};

describe('FolderManager', () => {
  it('reveals managed folders and selects one', async () => {
    render(<FolderManager {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));

    fireEvent.click(screen.getByRole('button', { name: 'Root' }));
    expect(baseProps.onSelectFolder).toHaveBeenCalledWith('/');
    expect(screen.getByText('2 images · 1 videos')).toBeInTheDocument();
  });

  it('renames a folder through the inline form', async () => {
    render(<FolderManager {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[1]);

    fireEvent.change(screen.getByLabelText('New path for /empty'), {
      target: { value: '/renamed' },
    });
    fireEvent.submit(screen.getByLabelText('New path for /empty').closest('form')!);

    await waitFor(() => expect(baseProps.onRenameFolder).toHaveBeenCalledWith('/empty', '/renamed'));
  });

  it('prevents deleting occupied folders', () => {
    render(<FolderManager {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));

    expect(screen.getByRole('button', { name: 'Not Empty' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Delete$/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(baseProps.onDeleteFolder).toHaveBeenCalledWith('/empty');
  });
});
