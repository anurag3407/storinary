import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormatChart } from '@/components/dashboard/FormatChart';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentUploads } from '@/components/dashboard/RecentUploads';
import { StatCard } from '@/components/dashboard/StatCard';
import type { StatsResponse } from '@/types';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Overview of your image CDN. View storage stats, recent uploads, and quick actions.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let stats: StatsResponse | null = null;

  try {
    // Forward the session cookie so /api/stats works when auth is enabled
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${base}/api/stats`, {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (response.ok) {
      stats = await response.json();
    }
  } catch {
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

  return (
    <>
      <Header
        title="Dashboard"
        description="Overview of your image CDN."
        actions={
          <Link href="/upload">
            <Button icon="⬆️">Quick Upload</Button>
          </Link>
        }
      />

      <div className={styles.statsGrid}>
        <StatCard
          label="Total Images"
          value={stats.totalImages.toLocaleString()}
          icon="📷"
          color="var(--nb-yellow)"
        />
        <StatCard
          label="Storage Used"
          value={stats.totalStorageFormatted}
          icon="💾"
          color="var(--nb-blue)"
        />
        <StatCard
          label="This Month"
          value={stats.uploadsThisMonth.toLocaleString()}
          icon="📅"
          color="var(--nb-mint)"
        />
        <StatCard
          label="Folders"
          value={folderCount.toLocaleString()}
          icon="📁"
          color="var(--nb-lavender)"
        />
      </div>

      <FormatChart data={stats.imagesByFormat} total={stats.totalImages} />

      <RecentUploads images={stats.recentUploads} />

      <QuickActions />
    </>
  );
}
