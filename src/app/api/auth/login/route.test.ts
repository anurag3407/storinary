// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const originalPassword = process.env.STORINARY_ADMIN_PASSWORD;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.STORINARY_ADMIN_PASSWORD;
    } else {
      process.env.STORINARY_ADMIN_PASSWORD = originalPassword;
    }
  });

  it('returns 404 when auth is disabled', async () => {
    delete process.env.STORINARY_ADMIN_PASSWORD;
    const response = await POST(makeRequest({ password: 'x' }));
    expect(response.status).toBe(404);
  });

  it('returns 400 when no password is provided', async () => {
    process.env.STORINARY_ADMIN_PASSWORD = 'secret';
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 401 for the wrong password', async () => {
    process.env.STORINARY_ADMIN_PASSWORD = 'secret';
    const response = await POST(makeRequest({ password: 'wrong' }));
    expect(response.status).toBe(401);
  });

  it('sets an httpOnly session cookie for the right password', async () => {
    process.env.STORINARY_ADMIN_PASSWORD = 'secret';
    const response = await POST(makeRequest({ password: 'secret' }));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get('set-cookie') || '';
    expect(setCookie).toContain('storinary_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
  });
});
