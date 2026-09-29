import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_STORAGE_LIMIT_BYTES,
  checkStorageQuota,
  getAccountStorageUsage,
  getInFlightBytes,
  releasePendingBytes,
  reservePendingBytes,
  resetPendingBytes,
} from './quota';
import { rawPrisma } from './prisma';

vi.mock('./prisma', () => ({
  prisma: {},
  rawPrisma: {
    image: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    imageVersion: {
      aggregate: vi.fn(),
    },
    video: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    videoVersion: {
      aggregate: vi.fn(),
    },
    videoRendition: {
      aggregate: vi.fn(),
    },
    videoHlsPackage: {
      aggregate: vi.fn(),
    },
    videoDashPackage: {
      aggregate: vi.fn(),
    },
    videoClip: {
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('./tenant', () => ({
  getTenantIdOrNull: vi.fn().mockResolvedValue('test-org-123'),
}));

describe('quota module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPendingBytes();
  });

  it('calculates account usage correctly under 100 MB free limit', async () => {
    vi.mocked(rawPrisma.image.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    } as never);
    vi.mocked(rawPrisma.imageVersion.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    } as never);
    vi.mocked(rawPrisma.image.count).mockResolvedValueOnce(5 as never);

    vi.mocked(rawPrisma.video.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 15 * 1024 * 1024 }, // 15 MB
    } as never);
    vi.mocked(rawPrisma.videoVersion.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 3 * 1024 * 1024 }, // 3 MB
    } as never);
    vi.mocked(rawPrisma.videoRendition.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoHlsPackage.aggregate).mockResolvedValueOnce({
      _sum: { totalFileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoDashPackage.aggregate).mockResolvedValueOnce({
      _sum: { totalFileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoClip.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.video.count).mockResolvedValueOnce(2 as never);

    const usage = await getAccountStorageUsage('test-org-123');

    // Total used: 10 + 2 + 15 + 3 = 30 MB
    expect(usage.usedBytes).toBe(30 * 1024 * 1024);
    expect(usage.limitBytes).toBe(ACCOUNT_STORAGE_LIMIT_BYTES);
    expect(usage.limitFormatted).toBe('100 MB');
    expect(usage.remainingBytes).toBe(70 * 1024 * 1024);
    expect(usage.percentage).toBe(30);
    expect(usage.isExceeded).toBe(false);
    expect(usage.isNearLimit).toBe(false);
    expect(usage.totalImages).toBe(5);
    expect(usage.totalVideos).toBe(2);
  });

  it('marks isNearLimit as true when usage is at or above 80%', async () => {
    vi.mocked(rawPrisma.image.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 85 * 1024 * 1024 }, // 85 MB
    } as never);
    vi.mocked(rawPrisma.imageVersion.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.image.count).mockResolvedValueOnce(20 as never);
    vi.mocked(rawPrisma.video.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoVersion.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoRendition.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoHlsPackage.aggregate).mockResolvedValueOnce({
      _sum: { totalFileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoDashPackage.aggregate).mockResolvedValueOnce({
      _sum: { totalFileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.videoClip.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 0 },
    } as never);
    vi.mocked(rawPrisma.video.count).mockResolvedValueOnce(0 as never);

    const usage = await getAccountStorageUsage('test-org-123');
    expect(usage.percentage).toBe(85);
    expect(usage.isNearLimit).toBe(true);
    expect(usage.isExceeded).toBe(false);
  });

  it('allows upload when within 100 MB quota', async () => {
    vi.mocked(rawPrisma.image.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 50 * 1024 * 1024 },
    } as never);
    vi.mocked(rawPrisma.imageVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.image.count).mockResolvedValueOnce(1 as never);
    vi.mocked(rawPrisma.video.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoRendition.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoHlsPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoDashPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoClip.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.video.count).mockResolvedValueOnce(0 as never);

    const check = await checkStorageQuota('test-org-123', 10 * 1024 * 1024); // 50 + 10 = 60 MB <= 100 MB
    expect(check.allowed).toBe(true);
    expect(check.isExceeded).toBe(false);
    expect(check.error).toBeUndefined();
  });

  it('rejects upload when projected usage exceeds 100 MB limit', async () => {
    vi.mocked(rawPrisma.image.aggregate).mockResolvedValueOnce({
      _sum: { fileSize: 90 * 1024 * 1024 }, // 90 MB used
    } as never);
    vi.mocked(rawPrisma.imageVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.image.count).mockResolvedValueOnce(10 as never);
    vi.mocked(rawPrisma.video.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoRendition.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoHlsPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoDashPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
    vi.mocked(rawPrisma.videoClip.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
    vi.mocked(rawPrisma.video.count).mockResolvedValueOnce(0 as never);

    const check = await checkStorageQuota('test-org-123', 15 * 1024 * 1024); // 90 + 15 = 105 MB > 100 MB
    expect(check.allowed).toBe(false);
    expect(check.isExceeded).toBe(true);
    expect(check.error).toContain('Storage quota exceeded');
    expect(check.error).toContain('100 MB');
  });

  it('prevents concurrent upload race conditions via in-flight reservation', async () => {
    // Current usage: 90 MB. Limit: 100 MB. Remaining: 10 MB.
    const mockUsage = () => {
      vi.mocked(rawPrisma.image.aggregate).mockResolvedValueOnce({
        _sum: { fileSize: 90 * 1024 * 1024 },
      } as never);
      vi.mocked(rawPrisma.imageVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
      vi.mocked(rawPrisma.image.count).mockResolvedValueOnce(1 as never);
      vi.mocked(rawPrisma.video.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
      vi.mocked(rawPrisma.videoVersion.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
      vi.mocked(rawPrisma.videoRendition.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
      vi.mocked(rawPrisma.videoHlsPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
      vi.mocked(rawPrisma.videoDashPackage.aggregate).mockResolvedValueOnce({ _sum: { totalFileSize: 0 } } as never);
      vi.mocked(rawPrisma.videoClip.aggregate).mockResolvedValueOnce({ _sum: { fileSize: 0 } } as never);
      vi.mocked(rawPrisma.video.count).mockResolvedValueOnce(0 as never);
    };

    // First request checks 8 MB with reserve: true -> should succeed and lock 8 MB in-flight
    mockUsage();
    const req1 = await checkStorageQuota('test-org-123', 8 * 1024 * 1024, { reserve: true });
    expect(req1.allowed).toBe(true);
    expect(getInFlightBytes('test-org-123')).toBe(8 * 1024 * 1024);

    // Second simultaneous request arrives for 8 MB before req1 commits to DB -> should be rejected!
    mockUsage();
    const req2 = await checkStorageQuota('test-org-123', 8 * 1024 * 1024, { reserve: true });
    expect(req2.allowed).toBe(false);
    expect(req2.isExceeded).toBe(true);
    expect(req2.error).toContain('Storage quota exceeded');

    // Req1 completes and releases in-flight reservation
    releasePendingBytes('test-org-123', 8 * 1024 * 1024);
    expect(getInFlightBytes('test-org-123')).toBe(0);

    // Direct reservation and release
    reservePendingBytes('test-org-456', 500);
    expect(getInFlightBytes('test-org-456')).toBe(500);
    releasePendingBytes('test-org-456', 500);
    expect(getInFlightBytes('test-org-456')).toBe(0);
  });
});
