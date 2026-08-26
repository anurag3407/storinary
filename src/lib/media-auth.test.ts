// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  authorizeDashboardOrApiKey,
  authorizeDashboardOrReadApiKey,
} from './media-auth';

const {
  authenticateApiKeyMock,
  authenticateReadApiKeyMock,
  authenticateVideoApiKeyMock,
  isAuthEnabledMock,
  verifySessionTokenMock,
} =
  vi.hoisted(() => ({
    authenticateApiKeyMock: vi.fn(),
    authenticateReadApiKeyMock: vi.fn(),
    authenticateVideoApiKeyMock: vi.fn(),
    isAuthEnabledMock: vi.fn(),
    verifySessionTokenMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE: 'storinary_session',
  isAuthEnabled: isAuthEnabledMock,
  verifySessionToken: verifySessionTokenMock,
}));
vi.mock('@/lib/api-keys', () => ({
  authenticateApiKey: authenticateApiKeyMock,
  authenticateReadApiKey: authenticateReadApiKeyMock,
  authenticateVideoApiKey: authenticateVideoApiKeyMock,
}));

describe('authorizeDashboardOrApiKey', () => {
  beforeEach(() => {
    authenticateApiKeyMock.mockReset().mockResolvedValue({ ok: true, keyId: 'image-key' });
    authenticateVideoApiKeyMock.mockReset().mockResolvedValue({ ok: true, keyId: 'video-key' });
    authenticateReadApiKeyMock.mockReset().mockResolvedValue({ ok: true, keyId: 'read-key' });
    isAuthEnabledMock.mockReset().mockReturnValue(true);
    verifySessionTokenMock.mockReset().mockResolvedValue(false);
  });

  it('prefers API key authentication when a credential is present', async () => {
    const request = new NextRequest('http://localhost/api/upload', {
      headers: { 'x-api-key': 'stor_live_secret' },
    });

    await expect(authorizeDashboardOrApiKey(request)).resolves.toEqual({ ok: true, keyId: 'image-key' });
    expect(authenticateApiKeyMock).toHaveBeenCalled();
  });

  it('allows a dashboard session without an API key and preserves video scopes', async () => {
    verifySessionTokenMock.mockResolvedValue(true);
    const request = new NextRequest('http://localhost/api/videos', {
      headers: { cookie: 'storinary_session=valid' },
    });

    await expect(authorizeDashboardOrApiKey(request, undefined, 'video-upload')).resolves.toEqual({
      ok: true,
      keyId: null,
    });
    expect(authenticateVideoApiKeyMock).not.toHaveBeenCalled();
  });
});

describe('authorizeDashboardOrReadApiKey', () => {
  beforeEach(() => {
    authenticateReadApiKeyMock.mockReset().mockResolvedValue({ ok: true, keyId: 'read-key' });
    isAuthEnabledMock.mockReturnValue(true);
    verifySessionTokenMock.mockReset().mockResolvedValue(false);
  });

  it('requires read scope for API credentials', async () => {
    const request = new NextRequest('http://localhost/api/images', {
      headers: { authorization: 'Bearer stor_live_secret' },
    });

    await expect(authorizeDashboardOrReadApiKey(request)).resolves.toEqual({
      ok: true,
      keyId: 'read-key',
    });
    expect(authenticateReadApiKeyMock).toHaveBeenCalledWith(request);
  });

  it('allows a dashboard session without recording key usage', async () => {
    verifySessionTokenMock.mockResolvedValue(true);
    const request = new NextRequest('http://localhost/api/videos', {
      headers: { cookie: 'storinary_session=valid' },
    });

    await expect(authorizeDashboardOrReadApiKey(request)).resolves.toEqual({
      ok: true,
      keyId: null,
    });
    expect(authenticateReadApiKeyMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests without an API key', async () => {
    await expect(authorizeDashboardOrReadApiKey(new NextRequest('http://localhost/api/images')))
      .resolves.toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });
});
