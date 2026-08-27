'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingOrLogin = pathname === '/login';

  if (isLandingOrLogin) {
    return <div className="standalone-layout">{children}</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
