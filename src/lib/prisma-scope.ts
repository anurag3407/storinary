import type { PrismaClient } from '@prisma/client';
import {
  bindRequestScope,
  currentRequestScope,
  runInRequestScope,
  type RequestScope,
} from '@/lib/request-scope';

/**
 * Models whose rows belong to exactly one organization. Every read and write
 * through the exported client is automatically filtered or stamped with the
 * active organization, so callers cannot accidentally cross tenant boundaries.
 *
 * Better Auth's own models (user, session, account, verification,
 * organization, member, invitation) are deliberately excluded: they are
 * resolved before the tenant scope exists.
 */
const TENANT_MODELS = new Set([
  'Image', 'image', 'ImageVersion', 'imageVersion', 'AiInsight', 'aiInsight',
  'ApiKey', 'apiKey', 'ApiKeyUsageEvent', 'apiKeyUsageEvent',
  'Video', 'video', 'VideoClip', 'videoClip', 'VideoVersion', 'videoVersion',
  'VideoHlsPackage', 'videoHlsPackage', 'VideoDashPackage', 'videoDashPackage',
  'VideoRendition', 'videoRendition', 'WebhookEndpoint', 'webhookEndpoint',
  'WebhookDelivery', 'webhookDelivery', 'UploadPreset', 'uploadPreset',
  'NamedTransformation', 'namedTransformation', 'Collection', 'collection',
  'CollectionItem', 'collectionItem', 'MetadataField', 'metadataField',
  'StructuredMetadata', 'structuredMetadata',
]);

const READ_OPERATIONS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'findUnique', 'findUniqueOrThrow',
]);
const UNIQUE_WRITE_OPERATIONS = new Set(['update', 'delete', 'upsert']);

export function currentTenantScope(): string | undefined {
  return currentRequestScope()?.organizationId;
}

/**
 * Bind the active organization for the remainder of the current request.
 *
 * The tenant is recorded on the request scope opened by the Worker entry (see
 * `src/lib/request-scope.ts`); on Node, where no such scope exists, it is bound
 * to the current async graph directly.
 */
export function enterTenantScope(organizationId: string): void {
  const scope = currentRequestScope();
  if (scope) {
    scope.organizationId = organizationId;
    return;
  }
  if (!bindRequestScope({ organizationId })) {
    throw new Error(
      'Tenant scope is unavailable in this runtime: requests must run through the Worker entry (worker.mjs).'
    );
  }
}

/** Run `callback` with the given organization active, restoring the previous one after. */
export function runWithTenantScope<T>(organizationId: string, callback: () => T): T {
  const parent = currentRequestScope();
  if (!parent) {
    return runInRequestScope({ organizationId }, callback);
  }

  // Share one connection holder across parent and nested scopes so that any
  // Prisma client instantiated inside a nested scope is cached on the parent request.
  const connection = parent.connection ?? (parent.connection = { prisma: parent.prisma });

  if (!Object.getOwnPropertyDescriptor(parent, 'prisma')?.get) {
    Object.defineProperty(parent, 'prisma', {
      get: () => connection.prisma,
      set: (val: RequestScope['prisma']) => {
        connection.prisma = val;
      },
      enumerable: true,
      configurable: true,
    });
  }

  const childScope: RequestScope = {
    ...parent,
    organizationId,
    connection,
  };

  Object.defineProperty(childScope, 'prisma', {
    get: () => connection.prisma,
    set: (val: RequestScope['prisma']) => {
      connection.prisma = val;
    },
    enumerable: true,
    configurable: true,
  });

  return runInRequestScope(childScope, callback);
}

type DelegateCall = (args: unknown) => Promise<unknown>;

type ScopedArgs = { where?: Record<string, unknown>; data?: unknown; create?: unknown } & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withTenantFilter(args: unknown, organizationId: string): ScopedArgs {
  const record = isRecord(args) ? args : {};
  return { ...record, where: { ...(isRecord(record.where) ? record.where : {}), organizationId } };
}

function withTenantData(args: unknown, organizationId: string): ScopedArgs {
  const record = isRecord(args) ? args : {};
  if (Array.isArray(record.data)) {
    return { ...record, data: record.data.map((row) => ({ ...(isRecord(row) ? row : {}), organizationId })) };
  }
  return { ...record, data: { ...(isRecord(record.data) ? record.data : {}), organizationId } };
}

function withTenantUpsert(args: unknown, organizationId: string): ScopedArgs {
  const record = isRecord(args) ? args : {};
  return {
    ...record,
    where: { ...(isRecord(record.where) ? record.where : {}), organizationId },
    create: { ...(isRecord(record.create) ? record.create : {}), organizationId },
  };
}

async function resolveOrganizationId(): Promise<string> {
  const bound = currentTenantScope();
  if (bound) return bound;
  const { getTenantId } = await import('@/lib/tenant');
  return getTenantId();
}

type Delegate = Record<string, unknown>;

function wrapDelegate(delegate: Delegate): Delegate {
  return new Proxy(delegate, {
    get(target, property) {
      const method = Reflect.get(target, property);
      if (typeof method !== 'function') return method;

      const operation = String(property);

      return async (args?: unknown, ...rest: unknown[]) => {
        const organizationId = await resolveOrganizationId();

        if (READ_OPERATIONS.has(operation)) {
          // Prisma unique selectors accept exactly one unique key, so tenant
          // reads resolve through findFirst to keep the predicate guaranteed.
          const filtered = withTenantFilter(args, organizationId);
          if (operation === 'findUnique') {
            const fn = (target.findFirst || target.findUnique) as DelegateCall;
            return fn.call(target, filtered);
          }
          if (operation === 'findUniqueOrThrow') {
            const fn = (target.findFirstOrThrow || target.findUniqueOrThrow) as DelegateCall;
            return fn.call(target, filtered);
          }
          return method.call(target, filtered, ...rest);
        }

        if (UNIQUE_WRITE_OPERATIONS.has(operation)) {
          const filtered = withTenantFilter(args, organizationId);
          // Verify the row belongs to the active organization before mutating,
          // so a guessed id from another tenant never writes.
          const existing = await (target.findFirst as DelegateCall)({ where: filtered.where });
          if (!existing) throw new Error('Record not found in active organization');
          if (operation === 'upsert') return method.call(target, withTenantUpsert(args, organizationId), ...rest);
          return method.call(target, args, ...rest);
        }

        if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
          return method.call(target, withTenantData(args, organizationId), ...rest);
        }

        if (operation === 'updateMany' || operation === 'deleteMany') {
          return method.call(target, withTenantFilter(args, organizationId), ...rest);
        }

        return method.call(target, args, ...rest);
      };
    },
  });
}

/**
 * Wraps a Prisma client so tenant filtering cannot be forgotten at a call site.
 * The public type stays `PrismaClient`; the scoping is a runtime guarantee.
 */
export function createTenantScopedClient<T extends PrismaClient>(client: T): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async (...args: unknown[]) => {
          const callback = args.find((arg) => typeof arg === 'function');
          if (typeof callback !== 'function') return Reflect.apply(target.$transaction, target, args);
          const organizationId = await resolveOrganizationId();
          return Reflect.apply(target.$transaction, target, [
            (tx: PrismaClient) =>
              runWithTenantScope(organizationId, () => callback(createTenantScopedClient(tx))),
          ]);
        };
      }

      const delegate = Reflect.get(target, property, receiver);
      if (typeof delegate !== 'object' || delegate === null) return delegate;
      if (!TENANT_MODELS.has(String(property))) return delegate;
      return wrapDelegate(delegate as Delegate);
    },
  }) as T;
}
