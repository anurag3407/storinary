import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { getTenantIdOrNull, hasAuthenticatedUser } from '@/lib/tenant';

export const metadata: Metadata = {
  title: 'Storinary — The Zero-Cost Cloudinary Alternative',
  description:
    'Free, self-hosted Cloudinary alternative for Sayalabs. Bulk upload, transform, and serve images from Appwrite or Supabase Storage.',
};

export const dynamic = 'force-dynamic';

export default async function IndexPage() {
  const tenantId = await getTenantIdOrNull();

  if (!tenantId) {
    // A signed-in user without an active workspace must not be shown the
    // marketing page — its "Open Console" link points back to `/`, which would
    // trap them in a loop. Send them to workspace setup instead.
    if (await hasAuthenticatedUser()) {
      redirect('/onboarding');
    }
    // Otherwise this is a genuine visitor: show the SaaS Landing Page.
    return <LandingPage />;
  }

  return <DashboardClient />;
}
