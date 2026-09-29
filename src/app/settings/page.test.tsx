import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    organization: {
      getFullOrganization: vi.fn().mockResolvedValue({ data: null }),
      inviteMember: vi.fn().mockResolvedValue({ data: {} }),
    },
    signOut: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAppAuth: () => ({
    signOut: vi.fn(),
    isClerk: false,
    organizations: [],
    activeOrganizationId: null,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    addToast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

vi.mock('@/components/settings/MetadataFieldManager', () => ({
  MetadataFieldManager: () => <div data-testid="metadata-fields" />,
}));

vi.mock('@/components/layout/CreateWorkspaceModal', () => ({
  CreateWorkspaceModal: () => null,
}));

vi.mock('@/components/billing/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/stats')) {
        return jsonResponse({
          provider: 'supabase',
          providerName: 'Supabase Storage',
          storageEndpoint: 'https://example.supabase.co',
          storageBucket: 'storinary',
        });
      }
      if (url.includes('/api/quota')) {
        return jsonResponse({
          quota: {
            planName: 'Free Developer Tier',
            limitFormatted: '100 MB',
            usedFormatted: '0 B',
            remainingFormatted: '100 MB',
            imageBytesFormatted: '0 B',
            videoBytesFormatted: '0 B',
            percentage: 0,
            isExceeded: false,
            isNearLimit: false,
            totalImages: 0,
            totalVideos: 0,
          },
        });
      }
      if (url.includes('/api/api-keys')) return jsonResponse({ keys: [] });
      if (url.includes('/api/webhooks/deliveries')) return jsonResponse({ deliveries: [] });
      if (url.includes('/api/webhooks')) return jsonResponse({ webhooks: [] });
      if (url.includes('/api/upload-presets')) return jsonResponse({ presets: [] });
      if (url.includes('/api/named-transformations')) return jsonResponse({ transformations: [] });
      return jsonResponse({});
    }) as unknown as typeof fetch;
  });

  it('renders each settings section exactly once (no duplicated cards)', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
    });

    // Regression: "Named Transformations" used to render as two identical cards.
    expect(
      screen.getAllByRole('heading', { name: 'Named Transformations' })
    ).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Outbound Webhooks' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Upload Presets' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Workspace & Team' })).toHaveLength(1);
  });

  it('renders a single "Unsigned" preset control', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Upload Presets')).toBeInTheDocument();
    });

    // Regression: the unsigned checkbox was rendered twice on the same state.
    expect(screen.getAllByText('Unsigned')).toHaveLength(1);
  });
});
