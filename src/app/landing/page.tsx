import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Storinary — The Zero-Cost Cloudinary Alternative',
  description:
    'Free, self-hosted media delivery cloud. On-the-fly transformations, automatic WebP/AVIF optimization, and global edge delivery for Sayalabs.',
};

export default function MarketingLandingPage() {
  return <LandingPage />;
}
