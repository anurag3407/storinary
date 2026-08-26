import type { ApiKeyUsageAction } from '@/lib/api-keys';
import { prisma } from '@/lib/prisma';

const MAX_DAYS = 90;

export type ApiKeyUsageSummary = {
  range: { days: number; from: string };
  keys: Array<{
    id: string;
    name: string;
    lastFour: string;
    scopes: string[];
    usage: {
      requests: number;
      assets: number;
      errors: number;
      bytes: number;
      byAction: Record<ApiKeyUsageAction, { requests: number; assets: number; errors: number; bytes: number }>;
    };
  }>;
};

function emptyUsage() {
  const byAction = {
    upload: { requests: 0, assets: 0, errors: 0, bytes: 0 },
    'video-upload': { requests: 0, assets: 0, errors: 0, bytes: 0 },
    read: { requests: 0, assets: 0, errors: 0, bytes: 0 },
    delete: { requests: 0, assets: 0, errors: 0, bytes: 0 },
    write: { requests: 0, assets: 0, errors: 0, bytes: 0 },
  } satisfies Record<ApiKeyUsageAction, { requests: number; assets: number; errors: number; bytes: number }>;
  return {
    ...byAction.upload,
    byAction,
  };
}

export async function getApiKeyUsage(daysInput = 30): Promise<ApiKeyUsageSummary> {
  const days = Math.min(MAX_DAYS, Math.max(1, Number.isFinite(daysInput) ? daysInput : 30));
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const keyRows = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    where: { revokedAt: null },
    select: { id: true, name: true, lastFour: true, scopes: true },
  });

  const keys = keyRows.map((row) => ({
    id: row.id,
    name: row.name,
    lastFour: row.lastFour,
    scopes: row.scopes.split(',').filter(Boolean),
  }));

  const usageActions: ApiKeyUsageAction[] = ['upload', 'video-upload', 'read', 'write', 'delete'];
  const grouped = await prisma.apiKeyUsageEvent.groupBy({
    by: ['apiKeyId', 'action'],
    _sum: { requests: true, assets: true, errors: true, bytes: true },
    where: { periodStart: { gte: from }, apiKeyId: keys.length ? undefined : undefined },
  });

  const usageByKey = new Map(keys.map((key) => [key.id, emptyUsage()]));
  for (const row of grouped) {
    const action = row.action as ApiKeyUsageAction;
    if (!usageActions.includes(action)) continue;
    const usage = usageByKey.get(row.apiKeyId);
    if (!usage) continue;
    const actionUsage = usage.byAction[action];
    const requests = row._sum.requests || 0;
    const assets = row._sum.assets || 0;
    const errors = row._sum.errors || 0;
    const bytes = Number(row._sum.bytes || 0);
    Object.assign(actionUsage, { requests, assets, errors, bytes });
    usage.requests += requests;
    usage.assets += assets;
    usage.errors += errors;
    usage.bytes += bytes;
  }

  return {
    range: { days, from: from.toISOString() },
    keys: keys.map((key) => ({ ...key, usage: usageByKey.get(key.id)! })),
  };
}
