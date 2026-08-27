import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormatChart } from '@/components/dashboard/FormatChart';
import { DeliveryAnalyticsPanel } from '@/components/dashboard/DeliveryAnalytics';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentUploads } from '@/components/dashboard/RecentUploads';
import { StatCard } from '@/components/dashboard/StatCard';
import { getStats } from '@/lib/stats';
import type { StatsResponse } from '@/types';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Overview of your image CDN. View real storage stats, recent uploads, and delivery analytics.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let stats: StatsResponse | null = null;

  try {
    stats = await getStats();
  } catch (error) {
    console.error('Failed to query dashboard stats:', error);
    stats = null;
  }

  if (!stats) {
    return (
      <>
        <Header title="Dashboard" description="Overview of your image CDN." />
        <EmptyState
          icon="⚠️"
          title="Could not load dashboard"
          description="The stats API is unavailable. Check that your database and environment variables are configured correctly, then try again."
          action={
            <Link href="/upload">
              <Button icon="⬆️">Upload Images</Button>
            </Link>
          }
        />
      </>
    );
  }

  const folderCount = Object.keys(stats.imagesByFolder).length;
  const totalMedia = (stats.totalImages || 0) + (stats.totalVideos || 0);
  const providerLabel = stats.providerName || 'Appwrite Storage';
  const limitLabel = stats.storageLimitFormatted || '2 GB';

  return (
    <>
      <Header
        title="Dashboard"
        description={`Live overview of your media CDN — connected to ${providerLabel}.`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/upload">
              <Button icon="⬆️">Upload Image</Button>
            </Link>
            <Link href="/videos">
              <Button variant="secondary" icon="🎬">Video Library</Button>
            </Link>
          </div>
        }
      />

      <div className={styles.statsGrid}>
        <StatCard
          label="Total Media Assets"
          value={totalMedia.toLocaleString()}
          icon="📷"
          color="var(--nb-yellow)"
          sub={`${stats.totalImages} img • ${stats.totalVideos || 0} vid`}
        />
        <StatCard
          label="Real Storage Used"
          value={stats.totalStorageFormatted}
          icon="💾"
          color="var(--nb-blue)"
          sub={`${stats.storagePercentage || 0}% of ${limitLabel}`}
        />
        <StatCard
          label="Uploaded This Month"
          value={stats.uploadsThisMonth.toLocaleString()}
          icon="📅"
          color="var(--nb-mint)"
          sub="Current billing cycle"
        />
        <StatCard
          label="Virtual Folders"
          value={folderCount.toLocaleString()}
          icon="📁"
          color="var(--nb-lavender)"
          sub="Organized library"
        />
      </div>

      <FormatChart data={stats.imagesByFormat} total={stats.totalImages} />

      <DeliveryAnalyticsPanel />

      <RecentUploads images={stats.recentUploads} />

      <QuickActions />
    </>
  );
}
