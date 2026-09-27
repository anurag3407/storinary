'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import styles from './login.module.css';

type Mode = 'sign-in' | 'sign-up';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: '/onboarding',
        });
        if (result.error) {
          setError(result.error.message || 'Could not create account');
        } else {
          setMessage('Account created! Check your inbox to verify your email, then sign in.');
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
                const activeOrgId = (
                  sessionResult.data?.session as { activeOrganizationId?: string | null }
                )?.activeOrganizationId;
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
        if (result.error) {
          setError(result.error.message || 'Invalid email or password');
        }
      }
    } catch {
      setError('Authentication service is unavailable. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.authSplit}>
        {/* Left: Senior SaaS Showcase Panel */}
        <div className={styles.showcasePanel}>
          <div className={styles.panelHeader}>
            <Link href="/" className={styles.brandLink}>
              <Image
                src="/logo.png"
                alt="Storinary"
                width={36}
                height={36}
                className={styles.brandLogo}
                priority
              />
              <div className={styles.brandText}>
                <span className={styles.brandName}>STORINARY</span>
                <span className={styles.brandTagline}>BY SAYALABS</span>
              </div>
            </Link>
            <span className={styles.studioPill}>ENGINE v1.0</span>
          </div>

          <div className={styles.panelContent}>
            <div className={styles.heroBadge}>
              <span className={styles.badgePulse} />
              Zero-Cost Cloudinary Alternative
            </div>
            <h1 className={styles.heroHeading}>
              Ultra-fast media delivery. <span className={styles.highlightText}>Zero cloud bills.</span>
            </h1>
            <p className={styles.heroSubheading}>
              Transform, compress, and serve assets on the fly with native Sharp performance,
              unlimited Cloudflare edge caching, and isolated multi-tenant workspaces.
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>⚡</div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Drop-in Cloudinary Syntax</span>
                  <span className={styles.featureSub}>Use existing URL transforms without rewriting client code.</span>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🌐</div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Global Edge Delivery</span>
                  <span className={styles.featureSub}>330+ Anycast caching nodes with sub-20ms delivery.</span>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🏢</div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Isolated Workspaces</span>
                  <span className={styles.featureSub}>Dedicated organizations, scoped API keys, and custom domains.</span>
                </div>
              </div>
            </div>

            <div className={styles.codeCard}>
              <div className={styles.codeHeader}>
                <span>Instant Image Transformation</span>
                <div className={styles.codeDots}>
                  <div className={styles.codeDot} />
                  <div className={styles.codeDot} />
                  <div className={styles.codeDot} />
                </div>
              </div>
              <div className={styles.codeText}>
                GET /sayalabs/image/upload/<span className={styles.codeParam}>w_600,f_auto,q_80</span>/asset.webp
              </div>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <div className={styles.statusIndicator}>
              <span className={styles.statusDot} />
              <span>All Systems Operational</span>
            </div>
            <span>Open Source • GPL-3.0</span>
          </div>
        </div>

        {/* Right: Modern Neobrutalist Auth Card */}
        <div className={styles.formPanel}>
          <Link href="/" className={styles.backHomeLink}>
            ← Back to Storinary
          </Link>

          <div className={styles.authCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>◈</div>
              <h2 className={styles.cardTitle}>
                {mode === 'sign-in' ? 'Welcome back' : 'Create workspace account'}
              </h2>
              <p className={styles.cardSubtitle}>
                {mode === 'sign-in'
                  ? 'Sign in to manage your organizations and media assets.'
                  : 'Start serving images with zero egress costs in under 2 minutes.'}
              </p>
            </div>

            {/* Segmented Tab Switcher */}
            <div className={styles.tabSwitcher}>
              <button
                type="button"
                className={`${styles.tabBtn} ${mode === 'sign-in' ? styles.tabBtnActive : ''}`}
                onClick={() => {
                  setMode('sign-in');
                  setError(null);
                  setMessage(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${mode === 'sign-up' ? styles.tabBtnActive : ''}`}
                onClick={() => {
                  setMode('sign-up');
                  setError(null);
                  setMessage(null);
                }}
              >
                Create Account
              </button>
            </div>

            {/* Alert Notifications */}
            {error && (
              <div className={styles.alertError} role="alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className={styles.alertSuccess} role="status">
                <span>✓</span>
                <span>{message}</span>
              </div>
            )}

            {/* Auth Form */}
            <form className={styles.authForm} onSubmit={submit}>
              {mode === 'sign-up' && (
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    className={styles.fieldInput}
                    placeholder="e.g. Anurag Mishra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="email">
                  Work Email
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

              <div className={styles.inputGroup}>
                <div className={styles.inputLabel}>
                  <label htmlFor="password">Password</label>
                  {mode === 'sign-in' && (
                    <Link href="/forgot-password" className={styles.forgotLink}>
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className={styles.fieldWrapper}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={styles.fieldInput}
                    placeholder={mode === 'sign-up' ? 'Minimum 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
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

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <span>Authenticating…</span>
                ) : mode === 'sign-in' ? (
                  <>Sign In ➔</>
                ) : (
                  <>Create Free Account ➔</>
                )}
              </button>
            </form>

            <div className={styles.cardFooter}>
              <span>🔒 Protected by Better Auth • TLS 1.3 Session Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
