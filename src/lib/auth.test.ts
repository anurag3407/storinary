// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionToken,
  isAuthEnabled,
  safeEqual,
  verifySessionToken,
} from './auth';

describe('auth', () => {
  const originalPassword = process.env.STORINARY_ADMIN_PASSWORD;

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.STORINARY_ADMIN_PASSWORD;
    } else {
      process.env.STORINARY_ADMIN_PASSWORD = originalPassword;
    }
  });

  describe('isAuthEnabled', () => {
    it('is false when the password is not set', () => {
      delete process.env.STORINARY_ADMIN_PASSWORD;
      expect(isAuthEnabled()).toBe(false);
    });

    it('is true when the password is set', () => {
      process.env.STORINARY_ADMIN_PASSWORD = 'hunter2';
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe('session tokens', () => {
    beforeEach(() => {
      process.env.STORINARY_ADMIN_PASSWORD = 'test-secret';
    });

    it('creates a token that verifies', async () => {
      const token = await createSessionToken();
      expect(await verifySessionToken(token)).toBe(true);
    });

    it('rejects a tampered payload', async () => {
      const token = await createSessionToken();
      const [payload, sig] = token.split('.');
      const tampered = `${payload}x.${sig}`;
      expect(await verifySessionToken(tampered)).toBe(false);
    });

    it('rejects a token signed with a different password', async () => {
      process.env.STORINARY_ADMIN_PASSWORD = 'first-secret';
      const token = await createSessionToken();
      process.env.STORINARY_ADMIN_PASSWORD = 'second-secret';
      expect(await verifySessionToken(token)).toBe(false);
    });

    it('rejects expired tokens', async () => {
      const now = Date.now();
      const token = await createSessionToken(now);
      // 8 days later → beyond the 7-day TTL
      expect(await verifySessionToken(token, now + 8 * 24 * 60 * 60 * 1000)).toBe(false);
    });

    it('rejects malformed tokens', async () => {
      expect(await verifySessionToken('')).toBe(false);
      expect(await verifySessionToken('no-dot')).toBe(false);
      expect(await verifySessionToken(undefined)).toBe(false);
      expect(await verifySessionToken('a.b')).toBe(false);
    });

    it('rejects garbage that parses but is unsigned', async () => {
      // base64url of '{}' with an arbitrary signature
      const payload = btoa('{}').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(await verifySessionToken(`${payload}.AAAA`)).toBe(false);
    });
  });

  describe('safeEqual', () => {
    it('compares strings in constant time', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'abcd')).toBe(false);
      expect(safeEqual('', '')).toBe(true);
      expect(safeEqual('', 'a')).toBe(false);
    });
  });
});
