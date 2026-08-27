'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const toggleSidebar = () => {
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
        >
          ☰
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
