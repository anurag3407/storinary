import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createTenantScopedClient } from '@/lib/prisma-scope';
import { currentRequestScope } from '@/lib/request-scope';

/**
 * The single Prisma entry point for the app.
 *
 * The client is generated from `prisma/postgres/schema.prisma` (see `prebuild`
 * and `deploy`), engine-less (`engineType = "client"`) and speaks Postgres
 * through the `pg` driver adapter. That is the only setup that runs on
 * Cloudflare Workers: workerd refuses `WebAssembly.compile()`, so the wasm
 * query engine the default generator ships can never start there, and a native
 * engine is a foreign binary the runtime cannot execute at all.
 *
 * Workers also forbid moving a connection between requests, so on Workers the
 * client (and its pool) lives in the scope of the request that uses it — one
 * request, one connection. Node — dev server, tests, scripts — keeps one pooled
 * client for the whole process. Checks that need another provider (the SQLite
 * tenancy check) build their own client.
 *
 * On Workers the database is reached through Hyperdrive (see `wrangler.jsonc`):
 * Cloudflare keeps the encrypted, pooled connection to Postgres and the Worker
 * dials the local Hyperdrive endpoint. This is not a preference — workerd
 * refuses `tls: { rejectUnauthorized: false }`, which is what Supabase's
 * self-signed pooler certificate otherwise requires, so a direct connection
 * from the Worker could only ever be unencrypted.
 */

function isCloudflareWorker(): boolean {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined';
}

/** The Hyperdrive connection string for the current request, if bound. */
function hyperdriveUrl(): string | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE?.connectionString;
  } catch {
    // No Cloudflare request in flight (Node dev server, tests, scripts).
    return undefined;
  }
}

function getDatasourceUrl(): string | undefined {
  if (isCloudflareWorker()) {
    const url = hyperdriveUrl();
    if (!url) {
      throw new Error('HYPERDRIVE binding is missing — Prisma cannot reach Postgres from the Worker.');
    }
    return url;
  }

  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Clean surrounding quotes if present
  let cleanUrl = url.trim();
  if (
    (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) ||
    (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))
  ) {
    cleanUrl = cleanUrl.slice(1, -1).trim();
  }

  // If using Supabase Pooler (pooler.supabase.com), optimize for serverless execution:
  // Switch port 5432 (Session Mode max 15 clients) to 6543 (Transaction Mode).
  if (cleanUrl.includes('pooler.supabase.com')) {
    return cleanUrl.replace(':5432/', ':6543/');
  }

  return cleanUrl;
}

function createClient(): PrismaClient {
  const connectionString = getDatasourceUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — Prisma cannot connect.');
  }

  // Local development against SQLite: use PrismaClient directly without the Postgres adapter.
  if (connectionString.startsWith('file:')) {
    return new PrismaClient({
      datasourceUrl: connectionString,
      log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
    });
  }

  const sslConfig = process.env.DATABASE_CA_CERT
    ? { ssl: { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true } }
    : undefined;

  const adapter = new PrismaPg({
    connectionString,
    ...(sslConfig ? sslConfig : {}),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function clientForCurrentRuntime(): PrismaClient {
  if (!isCloudflareWorker()) {
    globalForPrisma.prisma ??= createClient();
    return globalForPrisma.prisma;
  }

  // The Worker entry opens a scope per request, so every query in this request
  // shares one client and one connection, both dropped when it ends.
  const scope = currentRequestScope();
  if (scope) return (scope.prisma ??= createClient());

  // No scope (work outside the request entry, e.g. a queue consumer): a client
  // that is used once and never handed to another request.
  return createClient();
}

/**
 * Lazily resolves to the client for the current runtime/request. Building it at
 * import time would open a connection the Worker is not allowed to keep.
 */
function lazyClient(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, property) {
      const client = clientForCurrentRuntime();
      const value = Reflect.get(client as object, property);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

export const rawPrisma: PrismaClient = lazyClient();

export const prisma: PrismaClient = createTenantScopedClient(rawPrisma);
