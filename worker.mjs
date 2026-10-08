// Cloudflare entry point for Storinary.
//
// Cloudflare's runtime does not implement `AsyncLocalStorage.enterWith()`, so
// per-request state (the active tenant, the Prisma connection) has to be placed
// in an async scope instead: this file opens exactly one scope per request and
// hands it to the OpenNext worker it wraps.
//
// `export *` keeps OpenNext's Durable Object classes reachable by the runtime.
import openNextWorker from './.open-next/worker.js';
import { AsyncLocalStorage } from 'node:async_hooks';

// `src/lib/request-scope.ts` reads this same slot, so entry and app share it.
const scope = (globalThis.__storinaryRequestScope ??= new AsyncLocalStorage());

export * from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    return scope.run({}, () => openNextWorker.fetch(request, env, ctx));
  },
};
