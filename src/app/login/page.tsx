'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    // Where to return after a successful login (set by middleware redirect)
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    setNextPath(next);

    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => setEnabled(Boolean(data?.enabled)))
      .catch(() => setEnabled(true));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Login failed');
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.logo} aria-hidden="true">
          S
        </div>
        <h1 className={styles.title}>STORINARY</h1>
        <p className={styles.subtitle}>Self-hosted image CDN</p>

        {!enabled && (
          <p className={styles.warning}>
            Authentication is not enabled. Set{' '}
            <code>STORINARY_ADMIN_PASSWORD</code> in your environment to
            protect uploads and deletes.
          </p>
        )}

        <label className={styles.label} htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          className="nb-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          autoFocus
          autoComplete="current-password"
        />

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" fullWidth loading={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
