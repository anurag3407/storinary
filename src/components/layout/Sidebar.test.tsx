import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    organization: { list: vi.fn().mockResolvedValue({ data: [] }) },
    getSession: vi.fn().mockResolvedValue({ data: { session: { activeOrganizationId: 'org-1' } } }),
  },
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAppAuth: () => ({
    organizations: [{ id: 'org-1', name: 'Acme Media', slug: 'acme' }],
    activeOrganizationId: 'org-1',
    setActiveOrganization: vi.fn(),
    isClerk: false,
  }),
}));

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button">UserButton</div>,
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }),
}));

describe('Sidebar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalStorageFormatted: '15 MB',
        storageLimitFormatted: '100 MB',
        storagePercentage: 15,
        providerName: 'Appwrite Storage',
      }),
    } as Response);
  });

  it('renders SaaS Plan badge, 100 MB quota, and navigation links', async () => {
    render(<Sidebar />);

    expect(screen.getByText('STORINARY')).toBeInTheDocument();
    expect(screen.getByText('FREE TIER')).toBeInTheDocument();
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
  });

  it('opens UpgradeModal when clicking Upgrade button', () => {
    render(<Sidebar />);

    const upgradeBtn = screen.getByText('Upgrade');
    fireEvent.click(upgradeBtn);

    expect(screen.getByText('Storinary Cloud Plans & Storage')).toBeInTheDocument();
    expect(screen.getByText('Pro Creator')).toBeInTheDocument();
  });

  it('opens UpgradeModal when receiving storinary:open-upgrade event', () => {
    render(<Sidebar />);

    fireEvent(window, new CustomEvent('storinary:open-upgrade'));

    expect(screen.getByText('Storinary Cloud Plans & Storage')).toBeInTheDocument();
    expect(screen.getByText('Pro Creator')).toBeInTheDocument();
  });
});
