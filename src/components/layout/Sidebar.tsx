'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import type { StatsResponse } from '@/types';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/upload', label: 'Upload', icon: '⬆️' },
  { href: '/gallery', label: 'Gallery', icon: '🖼️' },
  { href: '/videos', label: 'Videos', icon: '🎬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');

  // Toggle from Header hamburger (mobile)
  useEffect(() => {
    const handler = () => setIsOpen((o) => !o);
    window.addEventListener('storinary:toggle-sidebar', handler);
    return () => window.removeEventListener('storinary:toggle-sidebar', handler);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Load organizations for workspace selector
  useEffect(() => {
    void (async () => {
      try {
        const [orgsRes, sessionRes] = await Promise.all([
          authClient.organization.list(),
          authClient.getSession(),
        ]);
        if (orgsRes.data) {
          setOrganizations(orgsRes.data as Array<{ id: string; name: string; slug: string }>);
        }
        const currentActive = (sessionRes.data?.session as { activeOrganizationId?: string | null })?.activeOrganizationId;
        if (currentActive) {
          setActiveOrgId(currentActive);
        }
      } catch {
        /* auth unavailable */
      }
    })();
  }, [pathname]);

  const handleSelectWorkspace = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      router.push('/onboarding');
      return;
    }
    if (val && val !== activeOrgId) {
      try {
        await authClient.organization.setActive({ organizationId: val });
        setActiveOrgId(val);
        window.location.reload();
      } catch (err) {
        console.error('Failed to switch workspace:', err);
      }
    }
  };

  // Fetch real storage stats
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats(data);
        }
      })
      .catch(() => {
        /* stats unavailable */
      });
  }, [pathname]);

  // Hide sidebar on standalone landing / login / onboarding page
  if (pathname === '/login' || pathname === '/onboarding') {
    return null;
  }

  const usedFormatted = stats?.totalStorageFormatted || '0 B';
  const limitFormatted = stats?.storageLimitFormatted || '2 GB';
  const pct = stats?.storagePercentage ?? 0;
  const providerDisplay = stats?.providerName || 'Cloud Storage';

  return (
    <>
      {isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <Link href="/" className={styles.logo} onClick={() => setIsOpen(false)}>
          <Image
            src="/logo.png"
            alt="Storinary Mark"
            width={38}
            height={38}
            className={styles.logoMark}
            priority
          />
          <div className={styles.logoBrand}>
            <span className={styles.logoTitle}>STORINARY</span>
            <span className={styles.logoSub}>BY SAYALABS</span>
          </div>
        </Link>

        {organizations.length > 0 && (
          <div className={styles.workspaceSelector}>
            <span className={styles.workspaceLabel}>Workspace</span>
            <select
              aria-label="Select workspace"
              className={styles.workspaceSelect}
              value={activeOrgId}
              onChange={handleSelectWorkspace}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
              <option value="__new__">+ Create Workspace</option>
            </select>
          </div>
        )}

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.storageBox}>
          <div className={styles.storageHeader}>
            <span className={styles.storageLabel}>Storage ({providerDisplay})</span>
          </div>
          <span className={styles.storageValue}>
            {usedFormatted} / {limitFormatted}
          </span>
          <div
            className={styles.storageBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={styles.storageFill}
              style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
            />
          </div>
          <span className={styles.storageSub}>{pct}% used</span>
        </div>
      </aside>
    </>
  );
}
