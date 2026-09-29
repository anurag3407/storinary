'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MenuIcon } from '@/components/ui/icons';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep the toggle's expanded state in sync with the sidebar, which owns the
  // open/closed state (it also closes on backdrop click and navigation).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setSidebarOpen(Boolean(detail?.open));
    };
    window.addEventListener('storinary:sidebar-state', handler);
    return () => window.removeEventListener('storinary:sidebar-state', handler);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
    window.dispatchEvent(new CustomEvent('storinary:toggle-sidebar'));
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.hamburger}
          onClick={toggleSidebar}
          aria-label="Toggle navigation sidebar"
          aria-controls="app-sidebar"
          aria-expanded={sidebarOpen}
        >
          <MenuIcon size={20} />
        </button>
        <Link href="/" className={styles.mobileLogo} aria-label="Storinary Home">
          <Image
            src="/logo.png"
            alt="Storinary"
            width={140}
            height={36}
            className={styles.logoImg}
            priority
          />
        </Link>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
