'use client';

import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const isStandalone =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/landing' ||
    pathname.startsWith('/accept-invitation') ||
    (pathname === '/' && !session);

  if (isStandalone) {
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
