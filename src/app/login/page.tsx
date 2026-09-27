'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import styles from './login.module.css';

type Mode = 'sign-in' | 'sign-up';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextPath = searchParams.get('next');
  const callbackURL = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({ name, email, password, callbackURL: '/onboarding' });
        if (result.error) setError(result.error.message || 'Could not create account');
        else {
          setMessage('Check your inbox to verify your email, then sign in.');
          setMode('sign-in');
        }
      } else {
        const result = await authClient.signIn.email(
          { email, password },
          {
            onSuccess: async () => {
              try {
                const orgsResult = await authClient.organization.list();
                const orgs = (orgsResult.data ?? []) as Array<{ id: string; name: string }>;
                if (orgs.length === 0) {
                  router.replace('/onboarding');
                  return;
                }
                const sessionResult = await authClient.getSession();
                const activeOrgId = (sessionResult.data?.session as { activeOrganizationId?: string | null })?.activeOrganizationId;
                if (!activeOrgId && orgs.length > 0) {
                  await authClient.organization.setActive({ organizationId: orgs[0].id });
                }
                router.replace(callbackURL);
              } catch {
                router.replace(callbackURL);
              }
            },
            onError: (ctx) => setError(ctx.error.message || 'Invalid email or password'),
          }
        );
        if (result.error) setError(result.error.message || 'Invalid email or password');
      }
    } catch {
      setError('Authentication service is unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.mainGrid}>
      <div id="login-section" className={styles.loginCol}>
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBadge}>◈</div>
            <h1 className={styles.cardTitle}>{mode === 'sign-in' ? 'Welcome back' : 'Create your workspace account'}</h1>
            <p className={styles.cardSubtitle}>Verified email accounts, isolated media, and organization workspaces.</p>
          </div>
          {mode === 'sign-up' && <div className={styles.formGroup}><label className={styles.label} htmlFor="name">Name</label><input id="name" className={`nb-input ${styles.input}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>}
          <div className={styles.formGroup}><label className={styles.label} htmlFor="email">Email</label><input id="email" type="email" className={`nb-input ${styles.input}`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
          <div className={styles.formGroup}><label className={styles.label} htmlFor="password">Password</label><input id="password" type="password" className={`nb-input ${styles.input}`} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required /></div>
          {error && <div className={styles.errorBanner} role="alert">{error}</div>}
          {message && <div className={styles.warning} role="status">{message}</div>}
          <Button type="submit" fullWidth loading={loading}>{loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</Button>
          <button type="button" className={styles.warning} onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(null); setMessage(null); }}>{mode === 'sign-in' ? 'Need an account? Sign up' : 'Already registered? Sign in'}</button>
          <a className={styles.warning} href="/forgot-password">Forgot password?</a>
          <div className={styles.cardFooter}><span>Protected by Better Auth + SMTP verification</span></div>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
