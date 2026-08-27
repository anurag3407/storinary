'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);

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

  // Hide sidebar on standalone landing / login page
  if (pathname === '/login') {
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
            alt="Storinary"
            width={160}
            height={40}
            className={styles.logoImg}
            priority
          />
        </Link>

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
