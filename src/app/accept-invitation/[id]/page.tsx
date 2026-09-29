'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AlertIcon, SparklesIcon } from '@/components/ui/icons';
import styles from '@/app/login/login.module.css';

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const invitationId = String(params.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitationId) {
      setError('This invitation link is invalid.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await authClient.organization.acceptInvitation({ invitationId });
      if (result.error) {
        setError(result.error.message || 'Could not accept this invitation.');
        return;
      }

      // Make the joined workspace active so the dashboard opens into it.
      const data = result.data as
        | { organizationId?: string; invitation?: { organizationId?: string } }
        | null
        | undefined;
      const organizationId = data?.invitation?.organizationId ?? data?.organizationId;
      if (organizationId) {
        await authClient.organization.setActive({ organizationId });
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Could not accept this invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.formPanel} style={{ width: '100%' }}>
        <Link href="/" className={styles.backHomeLink}>
          ← Back to Storinary
        </Link>

        <div className={styles.authCard}>
          <div className={styles.cardTop}>
            <div className={styles.cardIcon}>
              <SparklesIcon size={22} />
            </div>
            <h1 className={styles.cardTitle}>Join this organization</h1>
            <p className={styles.cardSubtitle}>
              Sign in with the email address this invitation was sent to, then accept to join the
              workspace.
            </p>
          </div>

          {error && (
            <div className={styles.alertError} role="alert">
              <span className={styles.alertIcon}>
                <AlertIcon size={15} />
              </span>
              <span>{error}</span>
            </div>
          )}

          <form className={styles.authForm} onSubmit={handleAccept}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Accepting…' : 'Accept invitation ➔'}
            </button>
          </form>

          <div className={styles.cardFooter}>
            <span>
              Signed in with the wrong account?{' '}
              <Link href="/login" style={{ color: 'var(--ui-text)', fontWeight: 600 }}>
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
