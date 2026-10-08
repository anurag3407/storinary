import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';

/**
 * State that belongs to exactly one request.
 *
 * Cloudflare's runtime does not implement `AsyncLocalStorage.enterWith()`, so a
 * value cannot be attached to the async graph after the fact — it has to be
 * placed there by a `run()` call. The Worker entry (`worker.mjs`) therefore
 * opens one scope per request, and this module is looked up on `globalThis`
 * rather than being a module-private instance so the entry and the bundled app
 * always share the same storage. On Node (dev server, tests, scripts) the first
 * import simply creates it.
 */
export type RequestScope = {
  /** Active tenant, recorded by `enterTenantScope()` during authorization. */
  organizationId?: string;
  /** Shared connection holder across nested scopes in the same request. */
  connection?: { prisma?: PrismaClient };
  /** Prisma client (and its connection) pooled for this request only. */
  prisma?: PrismaClient;
};

type ScopeHolder = { __storinaryRequestScope?: AsyncLocalStorage<RequestScope> };

const holder = globalThis as unknown as ScopeHolder;
const scopeStorage: AsyncLocalStorage<RequestScope> = (holder.__storinaryRequestScope ??=
  new AsyncLocalStorage<RequestScope>());

export function currentRequestScope(): RequestScope | undefined {
  return scopeStorage.getStore();
}

/** Run `callback` against a fresh scope; everything inside it sees the same state. */
export function runInRequestScope<T>(scope: RequestScope, callback: () => T): T {
  return scopeStorage.run(scope, callback);
}

/**
 * Bind a scope to the current async graph. Only Node implements this — workerd
 * throws, which is reported as `false` so callers can fail closed.
 */
export function bindRequestScope(scope: RequestScope): boolean {
  try {
    scopeStorage.enterWith(scope);
    return true;
  } catch {
    return false;
  }
}
