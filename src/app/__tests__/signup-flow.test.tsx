import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockXmlHttpRequest } from '@/hooks/mock-xml-http-request';
import type { ImageRecord } from '@/types';

// ── Shared mocks ──────────────────────────────────────────────────────────

const { authClientMock, replaceMock, toastMock } = vi.hoisted(() => ({
  authClientMock: {
    signUp: { email: vi.fn() },
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
    getSession: vi.fn(),
    organization: {
      list: vi.fn(),
      create: vi.fn(),
      setActive: vi.fn(),
      getFullOrganization: vi.fn(),
      inviteMember: vi.fn(),
    },
  },
  replaceMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/auth-client', () => ({ authClient: authClientMock }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('mode=sign-up'),
}));

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAppAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    isClerk: false,
    user: { id: 'user_1', email: 'founder@acme.test', name: 'Acme Founder' },
    session: { user: { id: 'user_1' }, session: { activeOrganizationId: null } },
    activeOrganizationId: null,
    organizations: [],
    setActiveOrganization: vi.fn(),
    createOrganization: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: toastMock, addToast: vi.fn() }) }));
vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));
vi.mock('@/components/billing/UpgradeModal', () => ({ UpgradeModal: () => null }));

const uploadHelpers = vi.hoisted(() => ({
  compressImage: vi.fn(async (file: File) => file),
  createPreviewUrl: vi.fn(() => 'blob:preview'),
  loadUploadDefaults: vi.fn(() => ({
    compress: false,
    quality: 80,
    maxWidth: 2048,
    removeBg: false,
    moderate: false,
    folder: '/',
    tags: '',
  })),
  validateFile: vi.fn(() => null),
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
  formatRelativeTime: vi.fn(() => 'just now'),
}));

vi.mock('@/lib/upload-helpers', () => uploadHelpers);
vi.mock('@/lib/bg-removal', () => ({
  createSubjectMask: vi.fn(async () => new Blob()),
  analyzeSubjectMask: vi.fn(async () => ({ safe: true, score: 0.1, threshold: 0.82 })),
  removeBg: vi.fn(async () => new Blob()),
}));

const UPLOADED_IMAGE: ImageRecord = {
  id: 'img-1',
  originalName: 'first-upload.png',
  storagePath: 'acme/2026/09/first-upload.png',
  publicUrl: 'https://cdn.example/acme/first-upload.png',
  width: 640,
  height: 480,
  fileSize: 2048,
  format: 'png',
  mimeType: 'image/png',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  aiModerated: false,
  aiModerationScore: null,
  compressed: false,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
};

function installFetchMock() {
  globalThis.fetch = vi.fn((url: string) => {
    const body = url.includes('/api/quota')
      ? {
          quota: {
            usedFormatted: '0 B',
            limitFormatted: '100 MB',
            remainingFormatted: '100 MB',
            remainingBytes: 104857600,
            percentage: 0,
            isExceeded: false,
            isNearLimit: false,
          },
        }
      : url.includes('/api/upload-presets')
        ? { presets: [] }
        : {};
    return Promise.resolve({ ok: true, json: async () => body });
  }) as unknown as typeof fetch;
}

describe('sign-up → workspace → first upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetchMock();
    authClientMock.getSession.mockResolvedValue({
      data: { session: { activeOrganizationId: null }, user: { id: 'user_1' } },
    });
    authClientMock.organization.list.mockResolvedValue({ data: [] });
    authClientMock.signUp.email.mockResolvedValue({ data: { user: { id: 'user_1' } } });
    MockXmlHttpRequest.behavior.mockReset();
    MockXmlHttpRequest.behavior.mockImplementation((request: InstanceType<typeof MockXmlHttpRequest>) => {
      request.status = 200;
      request.responseText = JSON.stringify({ images: [UPLOADED_IMAGE], errors: [] });
      request.loadHandler?.(new ProgressEvent('load'));
    });
    Object.defineProperty(window, 'XMLHttpRequest', {
      configurable: true,
      writable: true,
      value: MockXmlHttpRequest,
    });
  });

  it('registers an account, sends the user to onboarding', async () => {
    const { default: LoginPage } = await import('@/app/login/page');
    const user = userEvent.setup();
    render(<LoginPage />);

    // The page opens in sign-up mode via ?mode=sign-up.
    await user.type(screen.getByLabelText(/full name/i), 'Acme Founder');
    await user.type(screen.getByLabelText(/work email/i), 'founder@acme.test');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create free account/i }));

    await waitFor(() => {
      expect(authClientMock.signUp.email).toHaveBeenCalledWith({
        name: 'Acme Founder',
        email: 'founder@acme.test',
        password: 'hunter2hunter2',
        callbackURL: '/onboarding',
      });
    });
    expect(await screen.findByText(/verify your email/i)).toBeInTheDocument();
  });

  it('creates a workspace and makes it active', async () => {
    authClientMock.organization.create.mockResolvedValue({
      data: { id: 'org_acme', name: 'Acme Studio', slug: 'acme-studio' },
    });
    authClientMock.organization.setActive.mockResolvedValue({ data: {} });

    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await screen.findByText(/welcome to storinary/i);
    await user.type(screen.getByLabelText(/new workspace name/i), 'Acme Studio');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => {
      expect(authClientMock.organization.create).toHaveBeenCalledWith({
        name: 'Acme Studio',
        slug: 'acme-studio',
      });
    });
    expect(authClientMock.organization.setActive).toHaveBeenCalledWith({
      organizationId: 'org_acme',
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('queues the first file and uploads it only when asked', async () => {
    const { default: UploadPage } = await import('@/app/upload/page');
    const { container } = render(<UploadPage />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(['hello'], 'first-upload.png', { type: 'image/png' })] },
    });

    // Queued, not uploaded yet — the drop zone never auto-starts.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload all \(1\)/i })).toBeEnabled();
    });
    expect(MockXmlHttpRequest.behavior).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /upload all \(1\)/i }));

    await waitFor(() => {
      expect(MockXmlHttpRequest.behavior).toHaveBeenCalled();
    });

    const body = MockXmlHttpRequest.lastInstance?.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect((body.get('file') as File).name).toBe('first-upload.png');
  });
});
