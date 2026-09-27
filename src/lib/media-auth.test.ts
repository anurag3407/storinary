// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { authorizeDashboardOrApiKey, authorizeDashboardOrReadApiKey } from './media-auth';

const { authenticateScopedApiKeyMock, getSessionMock, getTenantIdOrNullMock, enterTenantScopeMock } =
  vi.hoisted(() => ({
    authenticateScopedApiKeyMock: vi.fn(),
    getSessionMock: vi.fn(),
    getTenantIdOrNullMock: vi.fn(),
    enterTenantScopeMock: vi.fn(),
  }));

vi.mock('@/lib/api-keys', () => ({
  authenticateScopedApiKey: authenticateScopedApiKeyMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock('@/lib/tenant', () => ({
  getTenantIdOrNull: getTenantIdOrNullMock,
}));

vi.mock('@/lib/prisma-scope', () => ({
  enterTenantScope: enterTenantScopeMock,
}));

const VERIFIED_SESSION = {
  user: { id: 'user-1', email: 'owner@example.com', emailVerified: true },
  session: { id: 'session-1', activeOrganizationId: 'org-a' },
};

describe('authorizeDashboardOrApiKey', () => {
  beforeEach(() => {
    authenticateScopedApiKeyMock.mockReset();
    getSessionMock.mockReset();
    getTenantIdOrNullMock.mockReset();
    enterTenantScopeMock.mockReset();
    getTenantIdOrNullMock.mockResolvedValue('org-from-key');
  });

  it('prefers API key authentication and scopes the request to the key organization', async () => {
    authenticateScopedApiKeyMock.mockResolvedValue({
      ok: true,
      keyId: 'image-key',
      organizationId: 'org-from-key',
    });
    const request = new NextRequest('http://localhost/api/upload', {
      headers: { 'x-api-key': 'stor_live_secret' },
    });

    await expect(authorizeDashboardOrApiKey(request)).resolves.toEqual({
      ok: true,
      keyId: 'image-key',
      organizationId: 'org-from-key',
    });
    expect(authenticateScopedApiKeyMock).toHaveBeenCalled();
    expect(enterTenantScopeMock).toHaveBeenCalledWith('org-from-key');
  });

  it('rejects an API key whose organization cannot be resolved', async () => {
    authenticateScopedApiKeyMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'API key organization not found',
    });
    const request = new NextRequest('http://localhost/api/upload', {
      headers: { 'x-api-key': 'stor_live_secret' },
    });

    await expect(authorizeDashboardOrApiKey(request)).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'API key organization not found',
    });
    expect(enterTenantScopeMock).not.toHaveBeenCalled();
  });

  it('preserves the requested scope for video uploads', async () => {
    authenticateScopedApiKeyMock.mockResolvedValue({ ok: true, keyId: 'video-key' });
    const request = new NextRequest('http://localhost/api/videos', {
      headers: { 'x-api-key': 'stor_live_secret' },
    });

    await authorizeDashboardOrApiKey(request, undefined, 'video-upload');
    expect(authenticateScopedApiKeyMock).toHaveBeenCalledWith(
      request,
      undefined,
      undefined,
      'video-upload'
    );
  });

  it('allows a verified dashboard session and binds its active organization', async () => {
    getSessionMock.mockResolvedValue(VERIFIED_SESSION);
    const request = new NextRequest('http://localhost/api/videos');

    await expect(authorizeDashboardOrApiKey(request, undefined, 'video-upload')).resolves.toEqual({
      ok: true,
      keyId: null,
      organizationId: 'org-a',
    });
    expect(authenticateScopedApiKeyMock).not.toHaveBeenCalled();
    expect(enterTenantScopeMock).toHaveBeenCalledWith('org-a');
  });

  it('refuses an unverified account', async () => {
    getSessionMock.mockResolvedValue({
      user: { ...VERIFIED_SESSION.user, emailVerified: false },
      session: { id: 'session-1', activeOrganizationId: 'org-a' },
    });
    const request = new NextRequest('http://localhost/api/videos');

    await expect(authorizeDashboardOrApiKey(request)).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Verify your email first',
    });
    expect(enterTenantScopeMock).not.toHaveBeenCalled();
  });

  it('refuses a session with no active organization', async () => {
    getSessionMock.mockResolvedValue({
      user: VERIFIED_SESSION.user,
      session: { id: 'session-1', activeOrganizationId: null },
    });
    const request = new NextRequest('http://localhost/api/videos');

    await expect(authorizeDashboardOrApiKey(request)).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Select or create an organization first',
    });
  });
});

describe('authorizeDashboardOrReadApiKey', () => {
  beforeEach(() => {
    authenticateScopedApiKeyMock.mockReset();
    getSessionMock.mockReset();
    getTenantIdOrNullMock.mockReset().mockResolvedValue('org-from-key');
    enterTenantScopeMock.mockReset();
  });

  it('requires the read scope for API credentials', async () => {
    authenticateScopedApiKeyMock.mockResolvedValue({
      ok: true,
      keyId: 'read-key',
      organizationId: 'org-from-key',
    });
    const request = new NextRequest('http://localhost/api/images', {
      headers: { authorization: 'Bearer stor_live_secret' },
    });

    await expect(authorizeDashboardOrReadApiKey(request)).resolves.toEqual({
      ok: true,
      keyId: 'read-key',
      organizationId: 'org-from-key',
    });
    expect(authenticateScopedApiKeyMock).toHaveBeenCalledWith(
      request,
      undefined,
      undefined,
      'read'
    );
  });

  it('allows a dashboard session without recording key usage', async () => {
    getSessionMock.mockResolvedValue(VERIFIED_SESSION);
    const request = new NextRequest('http://localhost/api/videos');

    await expect(authorizeDashboardOrReadApiKey(request)).resolves.toEqual({
      ok: true,
      keyId: null,
      organizationId: 'org-a',
    });
    expect(authenticateScopedApiKeyMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests without an API key', async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(
      authorizeDashboardOrReadApiKey(new NextRequest('http://localhost/api/images'))
    ).resolves.toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });
});
