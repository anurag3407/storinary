// @vitest-environment node
/**
 * End-to-end tenancy and email-verification check.
 *
 * Runs against a real SQLite database and a real SMTP conversation to prove:
 * signup is blocked until verification, SMTP actually delivers mail, and two
 * organizations cannot see or mutate each other's media.
 */
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as net from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The app's Prisma client targets Postgres (see src/lib/prisma.ts). This check
// migrates and queries SQLite, so it supplies its own client to the same code
// paths — the ambient @prisma/client is the SQLite one (`npm run pretest`
// generates it) while the app build generates the Postgres one.
vi.mock('./prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { createTenantScopedClient } = await import('./prisma-scope');
  const rawPrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  return { rawPrisma, prisma: createTenantScopedClient(rawPrisma) };
});

const SMTP_CAPTURE_PORT = 2599;

const DB = '/tmp/storinary-e2e.db';
const SMTP_PORT = SMTP_CAPTURE_PORT;

process.env.DATABASE_URL = `file:${DB}`;
process.env.BETTER_AUTH_SECRET = '0123456789abcdef0123456789abcdef';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3999';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = String(SMTP_PORT);
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'tester';
process.env.SMTP_PASSWORD = 'tester';
process.env.SMTP_FROM = 'Storinary <no-reply@storinary.test>';

let smtpServer: net.Server | undefined;

/** Read the SMTP conversation captured by the local capture server. */
function readMail(): string {
  try {
    const raw = readFileSync('/tmp/mail.log', 'utf8');
    return raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  } catch {
    return '';
  }
}

beforeAll(async () => {
  writeFileSync('/tmp/mail.log', '');

  // Reuse a capture server if one is already listening (for example in CI);
  // otherwise host one here so this check stays self-contained.
  const alreadyRunning = await new Promise<boolean>((resolve) => {
    const probe = net.connect(SMTP_CAPTURE_PORT, '127.0.0.1');
    probe.once('connect', () => {
      probe.destroy();
      resolve(true);
    });
    probe.once('error', () => resolve(false));
  });

  if (!alreadyRunning) {
    smtpServer = net.createServer((socket) => {
      socket.write('220 localhost ESMTP\r\n');
      socket.on('data', (chunk) => {
        const str = chunk.toString();
        appendFileSync('/tmp/mail.log', str);
        if (str.toUpperCase().includes('QUIT')) {
          socket.write('221 Bye\r\n');
          socket.end();
        } else if (str.toUpperCase().includes('DATA')) {
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise((resolve) => smtpServer?.listen(SMTP_CAPTURE_PORT, '127.0.0.1', () => resolve(null)));
  }

  // Build a real database for this run so the check exercises real SQL.
  rmSync(DB, { force: true });
  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    env: { ...process.env, DATABASE_URL: `file:${DB}` },
    stdio: 'ignore',
  });
}, 120000);

afterAll(async () => {
  // smtpServer is only set when this file started one, so it is safe to close.
  if (smtpServer) {
    await new Promise((resolve) => smtpServer?.close(() => resolve(null)));
  }
});

describe('multitenancy end to end', () => {
  it('blocks sign-in until the email is verified, then delivers over SMTP', async () => {
    const { auth } = await import('./auth');
    const { rawPrisma } = await import('./prisma');

    const signUp = await auth.api.signUpEmail({
      body: { email: 'owner@acme.test', password: 'SuperSecret123', name: 'Acme Owner' },
    });
    expect(signUp?.user?.email).toBe('owner@acme.test');
    expect(signUp?.token).toBeFalsy();

    const blocked = await auth.api
      .signInEmail({ body: { email: 'owner@acme.test', password: 'SuperSecret123' } })
      .catch((error: unknown) => ({ caught: error }));
    expect((blocked as { error?: unknown; caught?: unknown }).caught || !(blocked as { token?: string }).token).toBeTruthy();

    // SMTP really received the verification mail.
    const transcript = readMail();
    expect(transcript).toContain('owner@acme.test');
    expect(transcript).toMatch(/verify|token=/i);

    const tokens = [...transcript.matchAll(/token=([A-Za-z0-9._-]+)/g)];
    const token = tokens[tokens.length - 1]?.[1];
    expect(token).toBeTruthy();

    await auth.api.verifyEmail({ query: { token: token as string } });
    const verified = await rawPrisma.user.findUnique({ where: { email: 'owner@acme.test' } });
    expect(verified?.emailVerified).toBe(true);

    const signedIn = await auth.api
      .signInEmail({ body: { email: 'owner@acme.test', password: 'SuperSecret123' } })
      .catch((error: unknown) => error as { error: unknown });
    expect((signedIn as { error?: unknown }).error).toBeFalsy();
    expect((signedIn as { token?: string }).token).toBeTruthy();
  }, 30000);

  it('isolates media between organizations and blocks cross-tenant access', async () => {
    const { rawPrisma, prisma } = await import('./prisma');
    const { runWithTenantScope } = await import('./prisma-scope');
    const { tenantStoragePath, resolveTenantFromPath } = await import('./tenant');

    await rawPrisma.image.deleteMany({});
    await rawPrisma.organization.deleteMany({ where: { id: { in: ['org-a', 'org-b'] } } });
    const orgA = await rawPrisma.organization.create({ data: { id: 'org-a', name: 'Acme', slug: 'acme', createdAt: new Date() } });
    const orgB = await rawPrisma.organization.create({ data: { id: 'org-b', name: 'Globex', slug: 'globex', createdAt: new Date() } });

    const pathA = await runWithTenantScope(orgA.id, async () => {
      await prisma.image.create({
        data: {
          originalName: 'acme-hero.png', storagePath: 'hero.png', publicUrl: 'https://cdn/acme/hero.png',
          width: 10, height: 10, fileSize: 1, format: 'png', mimeType: 'image/png',
        },
      });
      return tenantStoragePath(orgA.id, 'hero.png');
    });
    expect(pathA).toBe('acme/hero.png');

    await runWithTenantScope(orgB.id, async () => {
      await prisma.image.create({
        data: {
          originalName: 'globex-logo.png', storagePath: 'logo.png', publicUrl: 'https://cdn/globex/logo.png',
          width: 10, height: 10, fileSize: 1, format: 'png', mimeType: 'image/png',
        },
      });
    });

    const acmeSees = await runWithTenantScope(orgA.id, () => prisma.image.findMany());
    expect(acmeSees).toHaveLength(1);
    expect(acmeSees[0].originalName).toBe('acme-hero.png');

    const globexSees = await runWithTenantScope(orgB.id, () => prisma.image.findMany());
    expect(globexSees).toHaveLength(1);
    expect(globexSees[0].originalName).toBe('globex-logo.png');

    // Guessing another tenant's id must not leak or mutate anything.
    const crossed = await runWithTenantScope(orgB.id, () =>
      prisma.image.findUnique({ where: { id: acmeSees[0].id } })
    );
    expect(crossed).toBeNull();

    await expect(
      runWithTenantScope(orgB.id, () =>
        prisma.image.update({ where: { id: acmeSees[0].id }, data: { altText: 'hijacked' } })
      )
    ).rejects.toThrow(/not found in active organization/i);

    const intact = await rawPrisma.image.findUnique({ where: { id: acmeSees[0].id } });
    expect(intact?.altText).toBe('');

    expect(await resolveTenantFromPath('acme/hero.png')).toBe(orgA.id);
    await expect(resolveTenantFromPath('evil/hero.png')).rejects.toThrow();
  }, 30000);

  it('scopes API keys to the organization that issued them', async () => {
    const { rawPrisma } = await import('./prisma');
    const { runWithTenantScope } = await import('./prisma-scope');
    const { createApiKey, authenticateScopedApiKey } = await import('./api-keys');

    const orgA = await rawPrisma.organization.findUniqueOrThrow({ where: { id: 'org-a' } });
    const created = await runWithTenantScope(orgA.id, () => createApiKey('Acme CI', 'read'));

    const authed = await authenticateScopedApiKey(
      new Request('https://x.test', { headers: { 'x-api-key': created.secret } }),
      undefined,
      undefined,
      'read'
    );
    expect(authed).toMatchObject({ ok: true, keyId: created.id, organizationId: orgA.id });
  }, 30000);
});
