import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// End-to-end smoke test for the two "recovery" journeys a user completes
// from an email link:
//
//   password reset:  /forgot-password  → email  →  /reset-password?token=…
//   invitation:      invite email      →          /accept-invitation/[id]
//
// The pages are rendered for real; only the Better Auth client and the
// router are mocked, so each test asserts the actual hand-off between the
// emailed link, the page, and the auth call it must produce.

const { authClientMock, replaceMock, refreshMock, searchParams, routeParams } =
  vi.hoisted(() => ({
    authClientMock: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      organization: {
        acceptInvitation: vi.fn(),
        setActive: vi.fn(),
      },
    },
    replaceMock: vi.fn(),
    refreshMock: vi.fn(),
    searchParams: { current: new URLSearchParams() },
    routeParams: { current: { id: 'invite-123' } },
  }));

vi.mock('@/lib/auth-client', () => ({ authClient: authClientMock }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: refreshMock }),
  useSearchParams: () => searchParams.current,
  useParams: () => routeParams.current,
}));

describe('password recovery journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.current = new URLSearchParams();
  });

  it('sends the reset email pointed at the page that consumes the token', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/registered email/i), 'founder@acme.test');
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));

    await waitFor(() => {
      expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
        email: 'founder@acme.test',
        // The emailed link must land on /reset-password — the only page that
        // reads ?token= and forwards it to the reset endpoint.
        redirectTo: '/reset-password',
      });
    });
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it('completes the reset with the token from the emailed link', async () => {
    searchParams.current = new URLSearchParams('token=reset-token-abc');
    authClientMock.resetPassword.mockResolvedValue({ data: {}, error: null });
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    const user = userEvent.setup();

    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText(/new password/i), 'hunter2hunter2');
    await user.type(screen.getByLabelText(/confirm password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(authClientMock.resetPassword).toHaveBeenCalledWith({
        newPassword: 'hunter2hunter2',
        token: 'reset-token-abc',
      });
    });
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('blocks the reset call when the two passwords disagree', async () => {
    searchParams.current = new URLSearchParams('token=reset-token-abc');
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    const user = userEvent.setup();

    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText(/new password/i), 'hunter2hunter2');
    await user.type(screen.getByLabelText(/confirm password/i), 'hunter2hunter3');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(authClientMock.resetPassword).not.toHaveBeenCalled();
  });

  it('shows the expired-link state when Better Auth bounces the link', async () => {
    // Better Auth redirects expired/used links to ?error=INVALID_TOKEN.
    searchParams.current = new URLSearchParams('error=INVALID_TOKEN');
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');

    render(<ResetPasswordPage />);

    expect(await screen.findByText(/reset link expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(authClientMock.resetPassword).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /request a new reset link/i })
    ).toHaveAttribute('href', '/forgot-password');
  });
});

describe('invitation acceptance journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams.current = { id: 'invite-123' };
  });

  it('accepts the invite, activates the joined workspace, and lands on the dashboard', async () => {
    authClientMock.organization.acceptInvitation.mockResolvedValue({
      data: { invitation: { organizationId: 'org_acme' } },
      error: null,
    });
    authClientMock.organization.setActive.mockResolvedValue({ data: {} });
    const { default: AcceptInvitationPage } = await import(
      '@/app/accept-invitation/[id]/page'
    );
    const user = userEvent.setup();

    render(<AcceptInvitationPage />);
    await user.click(screen.getByRole('button', { name: /accept invitation/i }));

    await waitFor(() => {
      expect(authClientMock.organization.acceptInvitation).toHaveBeenCalledWith({
        invitationId: 'invite-123',
      });
    });
    // The joined workspace becomes active so the dashboard opens into it.
    await waitFor(() => {
      expect(authClientMock.organization.setActive).toHaveBeenCalledWith({
        organizationId: 'org_acme',
      });
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows an inline error when the invitation can no longer be accepted', async () => {
    authClientMock.organization.acceptInvitation.mockResolvedValue({
      data: null,
      error: { message: 'Invitation has expired' },
    });
    const { default: AcceptInvitationPage } = await import(
      '@/app/accept-invitation/[id]/page'
    );
    const user = userEvent.setup();

    render(<AcceptInvitationPage />);
    await user.click(screen.getByRole('button', { name: /accept invitation/i }));

    expect(await screen.findByText(/invitation has expired/i)).toBeInTheDocument();
    expect(authClientMock.organization.setActive).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
