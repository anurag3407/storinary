'use client';

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
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
