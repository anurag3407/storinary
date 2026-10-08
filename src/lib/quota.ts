import * as prismaModule from '@/lib/prisma';
import { formatStorage } from '@/lib/stats';
import { getTenantIdOrNull } from '@/lib/tenant';

/**
 * 100 MB free tier storage limit for each account/organization.
 * SaaS billing / payments integration will unlock higher tiers (Pro 50 GB, Enterprise Unlimited).
 */
export const ACCOUNT_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 104,857,600 bytes
export const ACCOUNT_STORAGE_LIMIT_MB = 100;
export const ACCOUNT_DEFAULT_PLAN = 'Free Developer Tier';
export const PRO_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
export const PRO_PLAN_NAME = 'Pro Developer';

export interface AccountStorageUsage {
  organizationId: string;
  planName: string;
  limitBytes: number;
  limitFormatted: string;
  usedBytes: number;
  usedFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  imageBytes: number;
  imageBytesFormatted: string;
  videoBytes: number;
  videoBytesFormatted: string;
  totalImages: number;
  totalVideos: number;
  percentage: number;
  isExceeded: boolean;
  isNearLimit: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  requiredBytes: number;
  isExceeded: boolean;
  error?: string;
}

// In-memory cache for storage usage to protect Cloudflare Worker CPU limits (Free tier: 10-50ms)
const quotaUsageCache = new Map<string, { data: AccountStorageUsage; expiresAt: number }>();
const QUOTA_CACHE_TTL_MS = 60_000; // 60 seconds

export function invalidateQuotaCache(orgId?: string): void {
  if (orgId) {
    quotaUsageCache.delete(orgId);
  } else {
    quotaUsageCache.clear();
  }
}

/**
 * Calculates current real storage usage for a given organization across
 * images, image versions, videos, renditions, and streaming packages.
 */
export async function getAccountStorageUsage(
  orgId?: string
): Promise<AccountStorageUsage> {
  const organizationId = orgId || (await getTenantIdOrNull()) || 'legacy';

  const now = Date.now();
  if (process.env.NODE_ENV !== 'test') {
    const cached = quotaUsageCache.get(organizationId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const orgWhere = { organizationId };
  const db = prismaModule?.rawPrisma || prismaModule?.prisma;

  const [
    imageSumResult,
    imageVersionSumResult,
    imageCountResult,
    videoSumResult,
    videoVersionSumResult,
    videoRenditionSumResult,
    videoHlsSumResult,
    videoDashSumResult,
    videoClipSumResult,
    videoCountResult,
    orgResult,
  ] = await Promise.allSettled([
    db?.image?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.imageVersion?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.image?.count?.({ where: orgWhere }) ?? Promise.resolve(0),

    db?.video?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.videoVersion?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.videoRendition?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.videoHlsPackage?.aggregate?.({
      where: orgWhere,
      _sum: { totalFileSize: true },
    }) ?? Promise.resolve({ _sum: { totalFileSize: 0 } }),

    db?.videoDashPackage?.aggregate?.({
      where: orgWhere,
      _sum: { totalFileSize: true },
    }) ?? Promise.resolve({ _sum: { totalFileSize: 0 } }),

    db?.videoClip?.aggregate?.({
      where: orgWhere,
      _sum: { fileSize: true },
    }) ?? Promise.resolve({ _sum: { fileSize: 0 } }),

    db?.video?.count?.({ where: orgWhere }) ?? Promise.resolve(0),

    db?.organization?.findUnique?.({
      where: { id: organizationId },
      select: { metadata: true },
    }) ?? Promise.resolve(null),
  ]);

  const imageSum =
    imageSumResult.status === 'fulfilled' && imageSumResult.value?._sum?.fileSize
      ? Number(imageSumResult.value._sum.fileSize)
      : 0;

  const imageVersionSum =
    imageVersionSumResult.status === 'fulfilled' &&
    imageVersionSumResult.value?._sum?.fileSize
      ? Number(imageVersionSumResult.value._sum.fileSize)
      : 0;

  const totalImages =
    imageCountResult.status === 'fulfilled' ? Number(imageCountResult.value) : 0;

  const videoSum =
    videoSumResult.status === 'fulfilled' && videoSumResult.value?._sum?.fileSize
      ? Number(videoSumResult.value._sum.fileSize)
      : 0;

  const videoVersionSum =
    videoVersionSumResult.status === 'fulfilled' &&
    videoVersionSumResult.value?._sum?.fileSize
      ? Number(videoVersionSumResult.value._sum.fileSize)
      : 0;

  const videoRenditionSum =
    videoRenditionSumResult.status === 'fulfilled' &&
    videoRenditionSumResult.value?._sum?.fileSize
      ? Number(videoRenditionSumResult.value._sum.fileSize)
      : 0;

  const videoHlsSum =
    videoHlsSumResult.status === 'fulfilled' &&
    videoHlsSumResult.value?._sum?.totalFileSize
      ? Number(videoHlsSumResult.value._sum.totalFileSize)
      : 0;

  const videoDashSum =
    videoDashSumResult.status === 'fulfilled' &&
    videoDashSumResult.value?._sum?.totalFileSize
      ? Number(videoDashSumResult.value._sum.totalFileSize)
      : 0;

  const videoClipSum =
    videoClipSumResult.status === 'fulfilled' &&
    videoClipSumResult.value?._sum?.fileSize
      ? Number(videoClipSumResult.value._sum.fileSize)
      : 0;

  const totalVideos =
    videoCountResult.status === 'fulfilled' ? Number(videoCountResult.value) : 0;

  const imageBytes = imageSum + imageVersionSum;
  const videoBytes =
    videoSum +
    videoVersionSum +
    videoRenditionSum +
    videoHlsSum +
    videoDashSum +
    videoClipSum;
  const usedBytes = imageBytes + videoBytes;

  const orgData = orgResult.status === 'fulfilled' ? (orgResult.value as { metadata?: string | null } | null) : null;
  let isPro = false;
  if (orgData?.metadata) {
    try {
      const parsed = typeof orgData.metadata === 'string' ? JSON.parse(orgData.metadata) : orgData.metadata;
      if (parsed?.plan === 'pro' || parsed?.planName?.toLowerCase().includes('pro')) {
        isPro = true;
      }
    } catch {}
  }

  const limitBytes = isPro ? PRO_STORAGE_LIMIT_BYTES : ACCOUNT_STORAGE_LIMIT_BYTES;
  const planName = isPro ? PRO_PLAN_NAME : ACCOUNT_DEFAULT_PLAN;
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const percentage = Number(
    Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100)).toFixed(1)
  );
  const isExceeded = usedBytes >= limitBytes;
  const isNearLimit = percentage >= 80;

  const result: AccountStorageUsage = {
    organizationId,
    planName,
    limitBytes,
    limitFormatted: formatStorage(limitBytes),
    usedBytes,
    usedFormatted: formatStorage(usedBytes),
    remainingBytes,
    remainingFormatted: formatStorage(remainingBytes),
    imageBytes,
    imageBytesFormatted: formatStorage(imageBytes),
    videoBytes,
    videoBytesFormatted: formatStorage(videoBytes),
    totalImages,
    totalVideos,
    percentage,
    isExceeded,
    isNearLimit,
  };

  quotaUsageCache.set(organizationId, {
    data: result,
    expiresAt: Date.now() + QUOTA_CACHE_TTL_MS,
  });

  return result;
}

// In-flight bytes reservation per tenant to eliminate race conditions during concurrent parallel uploads
const inFlightBytesByOrg = new Map<string, number>();

export function getInFlightBytes(organizationId: string): number {
  return inFlightBytesByOrg.get(organizationId) || 0;
}

export function reservePendingBytes(organizationId: string, bytes: number): void {
  if (bytes <= 0) return;
  const current = inFlightBytesByOrg.get(organizationId) || 0;
  inFlightBytesByOrg.set(organizationId, current + bytes);
}

export function releasePendingBytes(organizationId: string, bytes: number): void {
  if (bytes <= 0) return;
  const current = inFlightBytesByOrg.get(organizationId) || 0;
  const remaining = Math.max(0, current - bytes);
  if (remaining === 0) {
    inFlightBytesByOrg.delete(organizationId);
  } else {
    inFlightBytesByOrg.set(organizationId, remaining);
  }
}

export function resetPendingBytes(): void {
  inFlightBytesByOrg.clear();
  quotaUsageCache.clear();
}

/**
 * Validates whether the account has enough remaining quota to accept an incoming payload.
 *
 * @param organizationId - The tenant's organization ID
 * @param additionalBytes - The total byte size of new assets about to be uploaded
 * @param options - Optional flags, such as { reserve: true } to lock pending bytes against concurrent requests
 */
export async function checkStorageQuota(
  organizationId: string,
  additionalBytes: number,
  options?: { reserve?: boolean }
): Promise<QuotaCheckResult> {
  const usage = await getAccountStorageUsage(organizationId);
  const inFlight = getInFlightBytes(organizationId);
  const effectiveUsed = usage.usedBytes + inFlight;
  const projectedTotal = effectiveUsed + additionalBytes;

  if (projectedTotal > usage.limitBytes) {
    const exceedsBy = projectedTotal - usage.limitBytes;
    return {
      allowed: false,
      usedBytes: effectiveUsed,
      limitBytes: usage.limitBytes,
      remainingBytes: Math.max(0, usage.limitBytes - effectiveUsed),
      requiredBytes: additionalBytes,
      isExceeded: true,
      error: `Storage quota exceeded: This workspace has used ${formatStorage(effectiveUsed)} of ${usage.limitFormatted} free tier storage. Uploading ${formatStorage(additionalBytes)} would exceed the quota by ${formatStorage(exceedsBy)}. Delete unused media or upgrade your plan.`,
    };
  }

  if (options?.reserve) {
    reservePendingBytes(organizationId, additionalBytes);
  }

  return {
    allowed: true,
    usedBytes: effectiveUsed,
    limitBytes: usage.limitBytes,
    remainingBytes: Math.max(0, usage.limitBytes - effectiveUsed),
    requiredBytes: additionalBytes,
    isExceeded: false,
  };
}

