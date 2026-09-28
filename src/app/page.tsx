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
import { LandingPage } from '@/components/landing/LandingPage';
import { getStats } from '@/lib/stats';
import { getTenantIdOrNull } from '@/lib/tenant';
import type { StatsResponse } from '@/types';
import { UploadIcon, VideoIcon, AlertIcon, FolderIcon, CameraIcon, DatabaseIcon, CalendarIcon } from '@/components/ui/icons';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Storinary — The Zero-Cost Cloudinary Alternative',
  description:
    'Free, self-hosted Cloudinary alternative for Sayalabs. Bulk upload, transform, and serve images from Appwrite or Supabase Storage.',
};

export const dynamic = 'force-dynamic';

export default async function IndexPage() {
  const tenantId = await getTenantIdOrNull();

  // If visitor is unauthenticated, present the SaaS Landing Page
  if (!tenantId) {
    return <LandingPage />;
  }

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
          icon={<AlertIcon size={26} />}
          title="Could not load dashboard"
          description="The stats API is unavailable. Check that your database and environment variables are configured correctly, then try again."
          action={
            <Link href="/upload">
              <Button icon={<UploadIcon size={16} />}>Upload Images</Button>
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

      <div className={styles.statsGrid}>
        <StatCard
          label="Total Media Assets"
          value={totalMedia.toLocaleString()}
          icon={<CameraIcon size={26} />}
          color="var(--ui-chart-1)"
          sub={`${stats.totalImages} img • ${stats.totalVideos || 0} vid`}
        />
        <StatCard
          label="Real Storage Used"
          value={stats.totalStorageFormatted}
          icon={<DatabaseIcon size={26} />}
          color="var(--ui-chart-2)"
          sub={`${stats.storagePercentage || 0}% of ${limitLabel}`}
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
          value={folderCount.toLocaleString()}
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
  );
}
