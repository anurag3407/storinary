'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormatChart } from '@/components/dashboard/FormatChart';
import { DeliveryAnalyticsPanel } from '@/components/dashboard/DeliveryAnalytics';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentUploads } from '@/components/dashboard/RecentUploads';
import { StatCard } from '@/components/dashboard/StatCard';
import type { StatsResponse } from '@/types';
import {
  UploadIcon,
  VideoIcon,
  AlertIcon,
  FolderIcon,
  CameraIcon,
  DatabaseIcon,
  CalendarIcon,
} from '@/components/ui/icons';
import styles from '@/app/page.module.css';

export function DashboardClient() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.status}`);
      }
      const data = (await response.json()) as StatsResponse;
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(
        'The stats API is unavailable. Check that your database and environment variables are configured correctly, then try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();

    const onQuotaUpdate = () => {
      void fetchStats();
    };
    window.addEventListener('storinary:quota-updated', onQuotaUpdate);
    return () => {
      window.removeEventListener('storinary:quota-updated', onQuotaUpdate);
    };
  }, [fetchStats]);

  const providerLabel = stats?.providerName || 'Appwrite Storage';
  const totalMedia = ((stats?.totalImages || 0) + (stats?.totalVideos || 0)).toLocaleString();
  const folderCount = Object.keys(stats?.imagesByFolder || {}).length.toLocaleString();

  return (
    <>
      <Header
        title="Dashboard"
        description={`Live overview of your media CDN — connected to ${providerLabel}.`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/upload">
              <Button icon={<UploadIcon size={16} />}>Upload Image</Button>
            </Link>
            <Link href="/videos">
              <Button variant="secondary" icon={<VideoIcon size={16} />}>
                Video Library
              </Button>
            </Link>
          </div>
        }
      />

      {isLoading && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.skeletonStatCard} />
            <div className={styles.skeletonStatCard} />
            <div className={styles.skeletonStatCard} />
            <div className={styles.skeletonStatCard} />
          </div>
          <div className={styles.skeletonSection} />
          <DeliveryAnalyticsPanel />
          <QuickActions />
        </>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={<AlertIcon size={26} />}
          headingLevel={2}
          title="Could not load dashboard"
          description={error}
          action={
            <Button icon={<UploadIcon size={16} />} onClick={() => void fetchStats()}>
              Retry
            </Button>
          }
        />
      )}

      {!isLoading && stats && (
        <>
          {(Boolean(stats.storagePercentage && stats.storagePercentage >= 80) ||
            Boolean(stats.isQuotaExceeded)) && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderRadius: 'var(--ui-radius-md, 8px)',
                marginBottom: '20px',
                backgroundColor: stats.isQuotaExceeded
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${
                  stats.isQuotaExceeded
                    ? 'rgba(239, 68, 68, 0.4)'
                    : 'rgba(245, 158, 11, 0.4)'
                }`,
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: stats.isQuotaExceeded ? '#ef4444' : '#f59e0b',
                    color: 'white',
                  }}
                >
                  {stats.isQuotaExceeded ? 'Quota Reached' : 'Storage Warning'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--ui-text)' }}>
                  {stats.isQuotaExceeded ? (
                    <strong>
                      Your account has reached the 100 MB free tier limit (
                      {stats.totalStorageFormatted} used). New uploads are paused.
                    </strong>
                  ) : (
                    <>
                      You have used <strong>{stats.totalStorageFormatted}</strong> of your{' '}
                      <strong>100 MB free limit</strong> ({stats.storagePercentage}%).
                    </>
                  )}
                </span>
              </div>
              <Link href="/settings">
                <Button size="sm" variant={stats.isQuotaExceeded ? 'primary' : 'secondary'}>
                  View Plan &amp; Storage
                </Button>
              </Link>
            </div>
          )}

          <div className={styles.statsGrid}>
            <StatCard
              label="Total Media Assets"
              value={totalMedia}
              icon={<CameraIcon size={26} />}
              color="var(--ui-chart-1)"
              sub={`${stats.totalImages} img • ${stats.totalVideos || 0} vid`}
            />
            <StatCard
              label="Real Storage Used"
              value={stats.totalStorageFormatted}
              icon={<DatabaseIcon size={26} />}
              color="var(--ui-chart-2)"
              sub={`${stats.storagePercentage || 0}% of ${stats.storageLimitFormatted || '100 MB'} (Free Plan)`}
            />
            <StatCard
              label="Uploaded This Month"
              value={stats.uploadsThisMonth.toLocaleString()}
              icon={<CalendarIcon size={26} />}
              color="var(--ui-chart-3)"
              sub="Current billing cycle"
            />
            <StatCard
              label="Virtual Folders"
              value={folderCount}
              icon={<FolderIcon size={26} />}
              color="var(--ui-chart-4)"
              sub="Organized library"
            />
          </div>

          <FormatChart data={stats.imagesByFormat} total={stats.totalImages} />

          <DeliveryAnalyticsPanel />

          <RecentUploads images={stats.recentUploads} />

          <QuickActions />
        </>
      )}
    </>
  );
}
