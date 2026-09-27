import { describe, expect, it } from 'vitest';
import { auth } from './auth';

describe('Better Auth tenant configuration', () => {
  it('mounts organization support and requires verified email sessions', () => {
    expect(auth.options.plugins.some((plugin) => plugin.id === 'organization')).toBe(true);
    expect(auth.options.emailAndPassword.requireEmailVerification).toBe(true);
  });
});
