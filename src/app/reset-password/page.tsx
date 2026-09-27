'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import styles from '@/app/login/login.module.css';

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.resetPassword({ newPassword: password });
      if (res.error) {
        setError(res.error.message || 'Password reset failed. The link may have expired.');
      } else {
        router.replace('/login');
      }
    } catch {
      setError('An error occurred during password reset. Please try again.');
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
            <div className={styles.cardIcon}>🔐</div>
            <h2 className={styles.cardTitle}>Set new password</h2>
            <p className={styles.cardSubtitle}>
              Choose a strong password with at least 8 characters.
            </p>
          </div>

          {error && (
            <div className={styles.alertError} role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="new-password">
                New Password
              </label>
              <div className={styles.fieldWrapper}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.fieldInput}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="confirm-password">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className={styles.fieldInput}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Updating password…' : 'Update password & sign in ➔'}
            </button>
          </form>

          <div className={styles.cardFooter}>
            <span>🔒 Session protected by Better Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
