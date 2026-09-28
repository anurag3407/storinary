'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import styles from '@/app/login/login.module.css';
import { KeyIcon, AlertIcon } from '@/components/ui/icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      });
      setSent(true);
    } catch {
      setError('Unable to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.formPanel} style={{ width: '100%' }}>
        <Link href="/login" className={styles.backHomeLink}>
          ← Back to Sign In
        </Link>

        <div className={styles.authCard}>
          <div className={styles.cardTop}>
            <div className={styles.cardIcon}><KeyIcon size={22} /></div>
            <h2 className={styles.cardTitle}>Reset your password</h2>
            <p className={styles.cardSubtitle}>
              Enter your work email address and we&apos;ll send you a secure link to reset your password.
            </p>
          </div>

          {error && (
            <div className={styles.alertError} role="alert">
              <span className={styles.alertIcon}><AlertIcon size={15} /></span>
              <span>{error}</span>
            </div>
          )}

          {sent ? (
            <div className={styles.alertSuccess} role="status">
              <span>✓</span>
              <div>
                <strong>Check your inbox!</strong>
                <p style={{ marginTop: '4px', fontSize: '12px' }}>
                  If an account exists for {email}, a password reset link has been sent.
                </p>
              </div>
            </div>
          ) : (
            <form className={styles.authForm} onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="email">
                  Registered Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className={styles.fieldInput}
                  placeholder="name@sayalabs.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Sending link…' : 'Send password reset link ➔'}
              </button>
            </form>
          )}

          <div className={styles.cardFooter}>
            <Link href="/login" style={{ color: 'var(--ui-text)', fontWeight: 600 }}>
              Remember your password? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
