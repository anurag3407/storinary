'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import styles from './login.module.css';

const FEATURES = [
  {
    icon: '⚡',
    title: 'On-The-Fly Transforms',
    desc: 'Resize, crop, rotate, format-shift (WebP/AVIF), and optimize images in real time via URL parameters.',
  },
  {
    icon: '🪄',
    title: 'WASM Background Removal',
    desc: 'Client-side AI runs directly in the browser. Zero server costs, 100% private, and unlimited.',
  },
  {
    icon: '🎬',
    title: 'Video Streaming & Renditions',
    desc: 'Range-request video streaming, automatic poster frame extraction, and multi-quality renditions.',
  },
  {
    icon: '🔒',
    title: 'Zero Lock-in & Ownership',
    desc: 'Your assets stay in your own Appwrite, Backblaze B2, or Supabase buckets with full control.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    setNextPath(
      next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
        ? next
        : '/'
    );

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
        setError(data?.error || 'Incorrect admin password');
        return;
      }
      window.location.href = nextPath || '/';
    } catch {
      setError('Login connection failed');
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.container}>
      {/* ─── Top Landing Navigation ─── */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          <Image
            src="/logo.png"
            alt="Storinary Logo"
            width={180}
            height={44}
            className={styles.navLogo}
            priority
          />
          <span className={styles.studioPill}>BY SAYALABS</span>
        </div>
        <div className={styles.navLinks}>
          <a
            href="https://sayalabs.in"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navLink}
          >
            Sayalabs Studio ↗
          </a>
          <button type="button" onClick={scrollToLogin} className={styles.navCta}>
            Studio Sign In
          </button>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className={styles.hero}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span>PRODUCTION CLOUD CDN ACTIVE</span>
        </div>
        <h1 className={styles.heroTitle}>
          Own Your Media.<br />
          <span className={styles.highlight}>Transform On-The-Fly.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          The high-speed, self-hosted media management and image transformation CDN for{' '}
          <strong>Sayalabs</strong>. No metered limits, no surprise bills, and zero vendor lock-in.
        </p>

        <div className={styles.heroActions}>
          <button type="button" onClick={scrollToLogin} className={styles.heroPrimaryBtn}>
            Enter Admin Studio ⚡
          </button>
          <a
            href="https://github.com/anurag3407/storinary-cloud"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.heroSecondaryBtn}
          >
            GitHub Repository
          </a>
        </div>
      </section>

      {/* ─── Main Content Grid: Login + Feature Showcase ─── */}
      <main className={styles.mainGrid}>
        {/* Left Column: Feature Highlights */}
        <div className={styles.featuresCol}>
          <h2 className={styles.sectionHeading}>Why Storinary CDN?</h2>
          <div className={styles.featureCards}>
            {FEATURES.map((feat) => (
              <div key={feat.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{feat.icon}</span>
                <div>
                  <h3 className={styles.featureTitle}>{feat.title}</h3>
                  <p className={styles.featureDesc}>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.transformBanner}>
            <div className={styles.codeHeader}>
              <span>URL TRANSFORMATION SYNTAX</span>
              <span className={styles.codeTag}>FAST CDN</span>
            </div>
            <pre className={styles.codeBlock}>
              <code>
                https://storinary.sayalabs.in/api/serve/hero.webp
                <span className={styles.codeParams}>?w=800&q=80&fit=crop&effect=sharpen</span>
              </code>
            </pre>
          </div>
        </div>

        {/* Right Column: Studio Sign In Card */}
        <div id="login-section" className={styles.loginCol}>
          <form className={styles.card} onSubmit={submit}>
            <div className={styles.cardHeader}>
              <div className={styles.iconBadge}>🔐</div>
              <h2 className={styles.cardTitle}>Studio Sign In</h2>
              <p className={styles.cardSubtitle}>
                Enter your admin password to access uploads, gallery, videos, and settings.
              </p>
            </div>

            {!enabled && (
              <div className={styles.warning}>
                <strong>Notice:</strong> Admin password is not set in environment. Access is currently open.
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="login-password">
                Admin Password
              </label>
              <input
                id="login-password"
                type="password"
                className={`nb-input ${styles.input}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className={styles.errorBanner} role="alert">
                ⚠️ {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} icon="🚀">
              {loading ? 'Authenticating…' : 'Access Studio'}
            </Button>

            <div className={styles.cardFooter}>
              <span>Powered by Appwrite Cloud & Supabase Postgres</span>
            </div>
          </form>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <p>© 2026 Sayalabs Studio. Built with Next.js 15, Sharp & Neobrutalism UI.</p>
      </footer>
    </div>
  );
}
