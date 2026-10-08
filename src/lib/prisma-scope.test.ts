import { describe, expect, it } from 'vitest';
import { currentTenantScope, enterTenantScope, runWithTenantScope } from './prisma-scope';
import { currentRequestScope, runInRequestScope, type RequestScope } from './request-scope';

/**
 * Cloudflare's runtime rejects `AsyncLocalStorage.enterWith()`, so the tenant
 * must survive on the request scope the Worker entry opens. These checks pin
 * that behaviour (and the Node fallback) down.
 */
describe('tenant scope', () => {
  it('records the entered tenant on the request scope', () => {
    runInRequestScope({}, () => {
      expect(currentTenantScope()).toBeUndefined();
      enterTenantScope('org-a');
      expect(currentTenantScope()).toBe('org-a');
    });
  });

  it('leaves nothing behind once the request scope ends', () => {
    runInRequestScope({}, () => enterTenantScope('org-a'));
    expect(currentTenantScope()).toBeUndefined();
  });

  it('scopes nested tenants and restores the previous one', () => {
    runInRequestScope({}, () => {
      enterTenantScope('org-a');
      expect(runWithTenantScope('org-b', () => currentTenantScope())).toBe('org-b');
      expect(currentTenantScope()).toBe('org-a');
    });
  });

  it('carries the request client into a nested tenant scope', () => {
    const client = { id: 'prisma-client' } as unknown as RequestScope['prisma'];
    runInRequestScope({ prisma: client }, () => {
      runWithTenantScope('org-b', () => {
        // Reusing the request's client keeps a nested tenant on the same
        // connection instead of opening another one.
        expect(currentRequestScope()?.prisma).toBe(client);
      });
    });
  });

  it('shares client created inside nested tenant scope with parent scope', () => {
    const parentScope: RequestScope = {};
    runInRequestScope(parentScope, () => {
      runWithTenantScope('org-b', () => {
        const client = { id: 'created-in-nested' } as unknown as RequestScope['prisma'];
        const current = currentRequestScope();
        if (current) current.prisma = client;
      });
      expect(currentRequestScope()?.prisma).toEqual({ id: 'created-in-nested' });
    });
  });

  // Kept last: the Node fallback binds to the surrounding async graph (that is
  // what `enterWith()` does), so it is the only case that outlives its test.
  it('falls back to the async graph when no request scope exists (Node)', () => {
    // An empty store reproduces Node without the Worker entry.
    runInRequestScope(undefined as unknown as RequestScope, () => {
      enterTenantScope('org-node');
      expect(currentTenantScope()).toBe('org-node');
    });
  });

  it('starts every request scope without a tenant', () => {
    runInRequestScope({}, () => expect(currentTenantScope()).toBeUndefined());
  });
});
