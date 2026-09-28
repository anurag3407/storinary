import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './QuickActions.module.css';
import { UploadIcon, ImageIcon, SettingsIcon } from '@/components/ui/icons';

export function QuickActions() {
  return (
    <div className={styles.actions}>
      <Link href="/upload" className={styles.link}>
        <Button variant="primary" size="lg" fullWidth icon={<UploadIcon size={16} />}>
          Upload Images
        </Button>
      </Link>
      <Link href="/gallery" className={styles.link}>
        <Button variant="secondary" size="lg" fullWidth icon={<ImageIcon size={16} />}>
          Browse Gallery
        </Button>
      </Link>
      <Link href="/settings" className={styles.link}>
        <Button variant="outline" size="lg" fullWidth icon={<SettingsIcon size={16} />}>
          Settings
        </Button>
      </Link>
    </div>
  );
}
