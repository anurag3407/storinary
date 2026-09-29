import type { ElementType, ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /**
   * Heading level for the title. Defaults to 3 (fits inside a page that already
   * has an h1/h2). Pass 1 when this is the page's top-level heading, e.g. the
   * not-found and error screens.
   */
  headingLevel?: 1 | 2 | 3;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as ElementType;

  return (
    <div className={styles.empty}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.description}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
