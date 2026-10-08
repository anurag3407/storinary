'use client';

import dynamic from 'next/dynamic';

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

export default function MarketingLandingPage() {
  return <LandingPage />;
}
