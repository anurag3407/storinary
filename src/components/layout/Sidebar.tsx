'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/upload', label: 'Upload', icon: '⬆️' },
  { href: '/gallery', label: 'Gallery', icon: '🖼️' },
  { href: '/videos', label: 'Videos', icon: '🎬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const FREE_STORAGE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);

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

  // Fetch storage stats
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.totalStorageBytes === 'number') {
          setStorageUsedBytes(data.totalStorageBytes);
        }
      })
      .catch(() => {
        /* stats unavailable */
      });
  }, []);

  const pct = Math.min(
    100,
    Math.round((storageUsedBytes / FREE_STORAGE_BYTES) * 100)
  );
  const usedFormatted =
    storageUsedBytes >= 1024 * 1024 * 1024
      ? `${(storageUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
      : `${(storageUsedBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      {isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <Link href="/" className={styles.logo} onClick={() => setIsOpen(false)}>
          <span className={styles.logoIcon} aria-hidden="true">
            🗂️
          </span>
          STORINARY
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
          <span className={styles.storageLabel}>Storage</span>
          <span className={styles.storageValue}>
            {usedFormatted} / 1 GB
          </span>
          <div className={styles.storageBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.storageFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </aside>
    </>
  );
}
