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
    const url = new URL(request.url);
    const isServeImage = request.method === 'GET' && url.pathname.startsWith('/api/serve/');

    const cacheKey = new Request(url.toString(), { method: 'GET' });

    // Check Cloudflare Edge Cache
    if (isServeImage && typeof caches !== 'undefined' && caches.default) {
      try {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          const hitHeaders = new Headers(cached.headers);
          hitHeaders.set('X-Storinary-Edge-Cache', 'HIT');
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: hitHeaders,
          });
        }
      } catch {
        // Cache miss
      }
    }

    const requestScope = {};
    try {
      const response = await scope.run(requestScope, () => openNextWorker.fetch(request, env, ctx));

      if (isServeImage && response.status === 200) {
        // Strip Next.js RSC vary headers that disrupt CDN and edge caching
        const sanitizedHeaders = new Headers(response.headers);
        sanitizedHeaders.delete('vary');
        sanitizedHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
        sanitizedHeaders.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
        sanitizedHeaders.set('Access-Control-Allow-Origin', '*');

        const cleanResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: sanitizedHeaders,
        });

        if (
          typeof caches !== 'undefined' &&
          caches.default &&
          ctx &&
          typeof ctx.waitUntil === 'function'
        ) {
          ctx.waitUntil(
            caches.default.put(cacheKey, cleanResponse.clone()).catch((err) => {
              console.error('Edge cache put error:', err);
            })
          );
        }

        return cleanResponse;
      }

      return response;
    } finally {
      if (requestScope.prisma) {
        const disconnectPromise = requestScope.prisma.$disconnect().catch(() => {});
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(disconnectPromise);
        }
      }
    }
  },
};
