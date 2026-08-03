import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './QuickActions.module.css';

export function QuickActions() {
  return (
    <div className={styles.actions}>
      <Link href="/upload" className={styles.link}>
        <Button variant="primary" size="lg" fullWidth icon="⬆️">
          Upload Images
        </Button>
      </Link>
      <Link href="/gallery" className={styles.link}>
        <Button variant="secondary" size="lg" fullWidth icon="🖼️">
          Browse Gallery
        </Button>
      </Link>
      <Link href="/settings" className={styles.link}>
        <Button variant="outline" size="lg" fullWidth icon="⚙️">
          Settings
        </Button>
      </Link>
    </div>
  );
}
