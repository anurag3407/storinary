import { describe, expect, it, vi } from 'vitest';
import { auth } from './auth';

// The app's Prisma client targets Postgres and builds a driver adapter around
// it. This check only reads auth configuration, so it stands in for the client
// instead of opening a connection.
vi.mock('./prisma', () => ({ prisma: {}, rawPrisma: {} }));

describe('Better Auth tenant configuration', () => {
  it('mounts organization support and requires verified email sessions', () => {
    expect(auth.options.plugins.some((plugin) => plugin.id === 'organization')).toBe(true);
    expect(auth.options.emailAndPassword.requireEmailVerification).toBe(true);
  });
});
