'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAppAuth } from '@/components/auth/AuthProvider';

const DashboardClient = dynamic(
  () => import('@/components/dashboard/DashboardClient').then((mod) => mod.DashboardClient),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ height: '2.5rem', width: '220px', background: 'var(--border, #2a2a2a)', borderRadius: '8px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: '90px', background: 'var(--card-bg, #1a1a1a)', borderRadius: '8px' }} />
          ))}
        </div>
      </div>
    ),
  }
);

const LandingPage = dynamic(
  () => import('@/components/landing/LandingPage').then((mod) => mod.LandingPage),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #333', borderTopColor: '#ff4d4d', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    ),
  }
);

export default function IndexPage() {
  const { isLoaded, isSignedIn, activeOrganizationId, organizations } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn && !activeOrganizationId && organizations.length === 0) {
      router.replace('/onboarding');
    }
  }, [isLoaded, isSignedIn, activeOrganizationId, organizations, router]);

  if (!isLoaded) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid #333', borderTopColor: '#ff4d4d', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  if (!activeOrganizationId && organizations.length === 0) {
    return null;
  }

  return <DashboardClient />;
}
