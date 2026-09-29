import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import ResetPasswordPage from './page';

const { replaceMock, searchParams } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParams: { current: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams.current,
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: { resetPassword: vi.fn() },
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.current = new URLSearchParams();
    vi.mocked(authClient.resetPassword).mockResolvedValue({ data: {}, error: null } as never);
  });

  it('forwards the reset token from the URL to the reset call', async () => {
    searchParams.current = new URLSearchParams('token=reset-token-123');
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText(/new password/i), 'hunter2hunter2');
    await user.type(screen.getByLabelText(/confirm password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(authClient.resetPassword).toHaveBeenCalledWith({
        newPassword: 'hunter2hunter2',
        token: 'reset-token-123',
      });
    });
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('shows an expired-link state instead of a form when no token is present', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText(/reset link expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(authClient.resetPassword).not.toHaveBeenCalled();
  });
});
