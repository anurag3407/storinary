'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppAuth } from '@/components/auth/AuthProvider';
import { ChartIcon, VideoIcon, ClipboardIcon, RocketIcon, ZapIcon, StarIcon, WrenchIcon, LockIcon, MoneyIcon, CarIcon, BotIcon, ShieldIcon, BellIcon, CheckIcon, FolderIcon, SparklesIcon, MenuIcon } from '@/components/ui/icons';
import styles from './LandingPage.module.css';

interface TransformationPreset {
  id: string;
  label: string;
  params: string;
  description: string;
  width: number;
  height: number;
  format: string;
  latencyMs: number;
  bandwidthSaved: string;
}

const PRESETS: TransformationPreset[] = [
  {
    id: 'original',
    label: 'Original Image',
    params: '',
    description: 'Raw uncompressed high-resolution asset directly from object storage.',
    width: 800,
    height: 800,
    format: 'PNG',
    latencyMs: 142,
    bandwidthSaved: '0%',
  },
  {
    id: 'webp_auto',
    label: 'Next-Gen WebP (q_80)',
    params: 'f_webp,q_80',
    description: 'Lossy WebP compression with perceptually tuned quality.',
    width: 800,
    height: 800,
    format: 'WEBP',
    latencyMs: 18,
    bandwidthSaved: '76%',
  },
  {
    id: 'thumb_fill',
    label: 'Smart Crop (w_400,h_400,c_fill)',
    params: 'w_400,h_400,c_fill,f_webp',
    description: 'Center-weighted smart crop scaled for profile cards or product grids.',
    width: 400,
    height: 400,
    format: 'WEBP',
    latencyMs: 16,
    bandwidthSaved: '84%',
  },
  {
    id: 'avif_small',
    label: 'Ultra AVIF (w_300,f_avif)',
    params: 'w_300,f_avif,q_75',
    description: 'Next-generation AVIF encoding saving up to 88% bandwidth over standard JPEG.',
    width: 300,
    height: 300,
    format: 'AVIF',
    latencyMs: 19,
    bandwidthSaved: '88%',
  },
  {
    id: 'blur_effect',
    label: 'Atmospheric Blur (e_blur_300)',
    params: 'w_500,e_blur_300,f_webp',
    description: 'Gaussian blur filter ideal for progressive hero placeholders and background masks.',
    width: 500,
    height: 500,
    format: 'WEBP',
    latencyMs: 22,
    bandwidthSaved: '82%',
  },
  {
    id: 'grayscale',
    label: 'B&W Grayscale (e_grayscale)',
    params: 'w_500,e_grayscale,f_webp',
    description: 'Single-channel luminance transform for editorial or monochrome branding.',
    width: 500,
    height: 500,
    format: 'WEBP',
    latencyMs: 15,
    bandwidthSaved: '80%',
  },
];

/** Public origin shown in docs/snippets — matches the deployment's own URL. */
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://storinary.sayalabs.in').replace(
  /\/+$/,
  ''
);

const CODE_EXAMPLES = {
  nextjs: `// Next.js 15 App Router Integration
import Image from 'next/image';

export function ProductHero() {
  return (
    <Image
      src="${APP_ORIGIN}/sayalabs/image/upload/w_1200,f_auto,q_80/hero.webp"
      alt="Hero Asset"
      width={1200}
      height={630}
      priority
    />
  );
}`,
  sdk: `// TypeScript / Node.js SDK
import { Storinary } from '@storinary/sdk';

const storinary = new Storinary({
  apiKey: process.env.STORINARY_API_KEY,
  cloudName: 'sayalabs',
});

// Upload image and get transformed delivery URL
const asset = await storinary.uploader.upload('./banner.png', {
  folder: '/marketing',
  transformation: { width: 800, format: 'webp', quality: 80 },
});

console.log(asset.secure_url);`,
  curl: `# REST API Upload (Cloudinary v1_1 compatible)
curl -X POST ${APP_ORIGIN}/api/v1_1/sayalabs/image/upload \\
  -H "Authorization: Bearer st_live_your_api_key" \\
  -F "file=@./photo.jpg" \\
  -F "folder=/products" \\
  -F "upload_preset=standard_web"`,
  migrate: `// Drop-in Migration: Just swap the domain!
// BEFORE (Cloudinary):
// https://res.cloudinary.com/sayalabs/image/upload/w_400,c_fill/photo.jpg

// AFTER (Storinary - Zero URL changes):
// ${APP_ORIGIN}/sayalabs/image/upload/w_400,c_fill/photo.jpg`,
};

export function LandingPage() {
  const { session } = useAppAuth();
  const [activePreset, setActivePreset] = useState<TransformationPreset>(PRESETS[1]);
  const [activeCodeTab, setActiveCodeTab] = useState<'nextjs' | 'sdk' | 'curl' | 'migrate'>('nextjs');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Let keyboard users dismiss the mobile menu with Escape.
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  const sampleUrl = activePreset.params
    ? `${APP_ORIGIN}/sayalabs/image/upload/${activePreset.params}/logo.png`
    : `${APP_ORIGIN}/sayalabs/image/upload/logo.png`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(sampleUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(CODE_EXAMPLES[activeCodeTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className={styles.landingRoot}>
      {/* ── Top Navbar ── */}
      <header className={styles.navbar}>
        <Link href="/" className={styles.navBrand}>
          <Image
            src="/logo.png"
            alt="Storinary"
            width={34}
            height={34}
            className={styles.navLogo}
            priority
          />
          <div className={styles.brandText}>
            <span className={styles.brandName}>STORINARY</span>
            <span className={styles.brandSub}>BY SAYALABS</span>
          </div>
          <span className={styles.studioPill}>OPEN SOURCE</span>
        </Link>

        <nav
          id="landing-nav"
          className={`${styles.navLinks} ${navOpen ? styles.navLinksOpen : ''}`}
        >
          <a href="#features" className={styles.navLink} onClick={() => setNavOpen(false)}>
            Features
          </a>
          <a href="#sandbox" className={styles.navLink} onClick={() => setNavOpen(false)}>
            Live Sandbox
          </a>
          <a href="#developer" className={styles.navLink} onClick={() => setNavOpen(false)}>
            Developers
          </a>
          <a href="#pricing" className={styles.navLink} onClick={() => setNavOpen(false)}>
            Plans &amp; Pricing
          </a>
          <a href="#compare" className={styles.navLink} onClick={() => setNavOpen(false)}>
            Why Storinary
          </a>
        </nav>

        <div className={styles.navActions}>
          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={navOpen}
            aria-controls="landing-nav"
          >
            <MenuIcon size={20} />
          </button>
          {session ? (
            <Link href="/" className={styles.navCtaBtn}>
              Open Console ➔
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.navLoginBtn}>
                Sign In
              </Link>
              <Link href="/login?mode=sign-up" className={styles.navCtaBtn}>
                Deploy Free ➔
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
      {/* ── Hero Section ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroBadge}>
          <span className={styles.badgeDot} />
          High-Performance Image & Video Engine • 100% Free Forever
        </div>

        <h1 className={styles.heroTitle}>
          Unlimited Media Delivery.
          <br />
          <span className={styles.heroHighlight}>Zero Cloud Invoices.</span>
        </h1>

        <p className={styles.heroSubtitle}>
          The modern, self-hosted Cloudinary alternative. Transform on-the-fly with native Sharp
          performance, cache globally on Cloudflare Anycast CDN, and host completely free on
          Appwrite & Supabase with zero vendor lock-in.
        </p>

        <div className={styles.heroActions}>
          <Link href="/login?mode=sign-up" className={styles.heroPrimaryBtn}>
            <RocketIcon size={17} /> Create Free Workspace
          </Link>
          <a href="#sandbox" className={styles.heroSecondaryBtn}>
            <ZapIcon size={17} /> Try Live Sandbox
          </a>
          <a
            href="https://github.com/anurag3407/storinary-cloud"
            target="_blank"
            rel="noreferrer"
            className={styles.installPill}
          >
            <span><StarIcon size={14} /> GitHub</span>
            <code>v1.0.0</code>
          </a>
        </div>

        <div className={styles.trustBanner}>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><ZapIcon size={17} /></span>
            <span>Sub-20ms Global Edge Cache</span>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><WrenchIcon size={17} /></span>
            <span>Drop-in Cloudinary API Syntax</span>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><LockIcon size={17} /></span>
            <span>Isolated Multi-Tenant Workspaces</span>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><MoneyIcon size={17} /></span>
            <span>$0.00 Egress & Storage Cost</span>
          </div>
        </div>
      </section>

      {/* ── Interactive Transformation Sandbox ── */}
      <section id="sandbox" className={styles.sandboxSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Interactive Playground</span>
          <h2 className={styles.sectionTitle}>See Transformations In Action</h2>
          <p className={styles.sectionSubtitle}>
            Toggle real-time transformations below to see instant image delivery and edge cache
            performance metrics.
          </p>
        </div>

        <div className={styles.sandboxCard}>
          <div className={styles.sandboxUrlBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--ui-success)', fontWeight: 600 }}>GET</span>
              <span className={styles.urlText}>
                {APP_ORIGIN}/sayalabs/image/upload/
                {activePreset.params && (
                  <span className={styles.urlParam}>{activePreset.params}/</span>
                )}
                logo.png
              </span>
            </div>
            <button type="button" className={styles.copyUrlBtn} onClick={handleCopyUrl}>
              {copiedUrl ? (
                <>
                  <CheckIcon size={14} /> Copied URL!
                  <span className="visually-hidden" role="status" aria-live="polite">
                    URL copied to clipboard
                  </span>
                </>
              ) : (
                <>
                  <ClipboardIcon size={14} /> Copy URL
                </>
              )}
            </button>
          </div>

          <div className={styles.sandboxBody}>
            {/* Left Controls */}
            <div className={styles.sandboxControls}>
              <div>
                <div className={styles.controlGroupTitle}>Transformation Presets</div>
                <div className={styles.presetChips} role="group" aria-label="Transformation presets">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`${styles.presetChip} ${
                        activePreset.id === preset.id ? styles.presetChipActive : ''
                      }`}
                      onClick={() => setActivePreset(preset)}
                      aria-pressed={activePreset.id === preset.id}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--ui-text-muted)', lineHeight: 1.5 }}>
                <strong>Description:</strong> {activePreset.description}
              </div>

              <div className={styles.sandboxStats}>
                <div className={styles.statRow}>
                  <span>Target Dimensions:</span>
                  <span className={styles.statValue}>
                    {activePreset.width} × {activePreset.height} px
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span>Output Format:</span>
                  <span className={styles.statValue}>{activePreset.format}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Delivery Latency:</span>
                  <span className={styles.statValue} style={{ color: 'var(--ui-success)' }}>
                    <ZapIcon size={12} /> {activePreset.latencyMs}ms (Edge Hit)
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span>Bandwidth Saved:</span>
                  <span className={styles.statValue} style={{ color: 'var(--ui-accent-text)' }}>
                    {activePreset.bandwidthSaved}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Preview */}
            <div className={styles.sandboxPreview}>
              <div
                className={styles.previewContainer}
                style={{
                  width: `${Math.min(activePreset.width, 360)}px`,
                  height: `${Math.min(activePreset.height, 320)}px`,
                  filter:
                    activePreset.id === 'blur_effect'
                      ? 'blur(8px)'
                      : activePreset.id === 'grayscale'
                      ? 'grayscale(100%)'
                      : 'none',
                  borderRadius: activePreset.id === 'thumb_fill' ? '50%' : '12px',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="Transformed Asset Preview"
                  width={320}
                  height={320}
                  className={styles.previewImg}
                  priority
                />
              </div>

              <div className={styles.previewBadge}>
                <span className={styles.previewBadgeDot} />
                <span>
                  {activePreset.params ? `Transform: ${activePreset.params}` : 'Raw Original'} •{' '}
                  {activePreset.format}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Pillars Section ── */}
      <section id="features" className={styles.pillarsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Core Advantages</span>
          <h2 className={styles.sectionTitle}>Engineered For Production Scale</h2>
          <p className={styles.sectionSubtitle}>
            Everything you expect from an enterprise image CDN without the enterprise price tag.
          </p>
        </div>

        <div className={styles.pillarsGrid}>
          <div className={styles.pillarCard}>
            <div className={styles.pillarIcon}>
              <ZapIcon size={24} />
            </div>
            <h3 className={styles.pillarTitle}>Drop-in Cloudinary Syntax</h3>
            <p className={styles.pillarDesc}>
              Migrate existing websites in minutes without rewriting front-end code. Use the exact
              same URL structure: <code>/w_400,c_fill,q_auto,f_auto/</code>.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarIcon}>
              <MoneyIcon size={24} />
            </div>
            <h3 className={styles.pillarTitle}>100% Free Infrastructure</h3>
            <p className={styles.pillarDesc}>
              No credit card required. Runs seamlessly on Vercel, Cloudflare, Appwrite, or Supabase
              with zero bandwidth or processing surcharges.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarIcon}>
              <FolderIcon size={24} />
            </div>
            <h3 className={styles.pillarTitle}>Multi-Tenant Workspaces</h3>
            <p className={styles.pillarDesc}>
              Create isolated client workspaces, invite team members, generate scoped API keys, and
              enforce role-based access control.
            </p>
          </div>
        </div>
      </section>

      {/* ── Developer Showcase Section ── */}
      <section id="developer" className={styles.codeSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Developer Experience</span>
          <h2 className={styles.sectionTitle}>Built By Developers, For Developers</h2>
          <p className={styles.sectionSubtitle}>
            Copy and paste production code snippets into your Next.js, React, or Node.js applications.
          </p>
        </div>

        <div className={styles.codeBox}>
          <div className={styles.codeNav} role="tablist" aria-label="Code examples">
            <button
              type="button"
              role="tab"
              id="code-tab-nextjs"
              aria-selected={activeCodeTab === 'nextjs'}
              aria-controls="code-panel"
              className={`${styles.codeTab} ${activeCodeTab === 'nextjs' ? styles.codeTabActive : ''}`}
              onClick={() => setActiveCodeTab('nextjs')}
            >
              Next.js 15 &lt;Image /&gt;
            </button>
            <button
              type="button"
              role="tab"
              id="code-tab-sdk"
              aria-selected={activeCodeTab === 'sdk'}
              aria-controls="code-panel"
              className={`${styles.codeTab} ${activeCodeTab === 'sdk' ? styles.codeTabActive : ''}`}
              onClick={() => setActiveCodeTab('sdk')}
            >
              TypeScript SDK
            </button>
            <button
              type="button"
              role="tab"
              id="code-tab-curl"
              aria-selected={activeCodeTab === 'curl'}
              aria-controls="code-panel"
              className={`${styles.codeTab} ${activeCodeTab === 'curl' ? styles.codeTabActive : ''}`}
              onClick={() => setActiveCodeTab('curl')}
            >
              cURL Upload API
            </button>
            <button
              type="button"
              role="tab"
              id="code-tab-migrate"
              aria-selected={activeCodeTab === 'migrate'}
              aria-controls="code-panel"
              className={`${styles.codeTab} ${activeCodeTab === 'migrate' ? styles.codeTabActive : ''}`}
              onClick={() => setActiveCodeTab('migrate')}
            >
              Cloudinary Migration
            </button>
            <button
              type="button"
              className={styles.copyUrlBtn}
              style={{ marginLeft: 'auto', margin: '8px 12px' }}
              onClick={handleCopyCode}
            >
              {copiedCode ? (
                <>
                  <CheckIcon size={14} /> Copied!
                  <span className="visually-hidden" role="status" aria-live="polite">
                    Code copied to clipboard
                  </span>
                </>
              ) : (
                <>
                  <ClipboardIcon size={14} /> Copy Code
                </>
              )}
            </button>
          </div>

          <div
            className={styles.codeBody}
            id="code-panel"
            role="tabpanel"
            aria-labelledby={`code-tab-${activeCodeTab}`}
            tabIndex={0}
          >
            <pre>
              <code>{CODE_EXAMPLES[activeCodeTab]}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── Deep Feature Grid ── */}
      <section className={styles.featuresGridSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Feature Matrix</span>
          <h2 className={styles.sectionTitle}>Complete Feature Parity</h2>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><CarIcon size={20} /></span>
            <h4 className={styles.featureBoxTitle}>libvips Sharp Engine</h4>
            <p className={styles.featureBoxDesc}>
              Blazing fast C++ image transformation pipeline. Resizes, converts, and strips metadata
              in under 25ms.
            </p>
          </div>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><VideoIcon size={18} /></span>
            <h4 className={styles.featureBoxTitle}>Video HLS & DASH</h4>
            <p className={styles.featureBoxDesc}>
              Automatic adaptive bitrate streaming packages, frame clip extraction, and high-res
              poster generation.
            </p>
          </div>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><BotIcon size={20} /></span>
            <h4 className={styles.featureBoxTitle}>AI Vision & Moderation</h4>
            <p className={styles.featureBoxDesc}>
              Integrated OpenAI-compatible image tagging, accessibility alt-text generation, and
              automated NSFW filtering.
            </p>
          </div>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><ShieldIcon size={20} /></span>
            <h4 className={styles.featureBoxTitle}>HMAC Signed URLs</h4>
            <p className={styles.featureBoxDesc}>
              Prevent bandwidth leeching and unauthorized parameter manipulation with cryptographic
              token verification.
            </p>
          </div>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><ChartIcon size={18} /></span>
            <h4 className={styles.featureBoxTitle}>Edge Analytics</h4>
            <p className={styles.featureBoxDesc}>
              Real-time dashboards tracking cache hit ratios, top requested renditions, and origin
              bandwidth saved.
            </p>
          </div>
          <div className={styles.featureBox}>
            <span className={styles.featureBoxIcon}><BellIcon size={20} /></span>
            <h4 className={styles.featureBoxTitle}>Outbound Webhooks</h4>
            <p className={styles.featureBoxDesc}>
              Deliver real-time webhook events on asset upload, transformation completion, and
              moderation flags.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Transparent Plans</span>
          <h2 className={styles.sectionTitle}>Predictable SaaS Pricing</h2>
          <p className={styles.sectionSubtitle}>
            Every account starts with 100 MB free cloud storage. Scale up effortlessly as your media delivery grows.
          </p>
        </div>

        <div className={styles.pricingNotice}>
          <SparklesIcon size={20} />
          <div>
            <strong>SaaS Storage Allocation:</strong> Every developer account is provisioned with <strong>100 MB complimentary storage</strong> with unrestricted transformations, global CDN delivery, and API keys. Automated billing will be enabled once payment gateways finalize.
          </div>
        </div>

        <div className={styles.pricingGrid}>
          {/* Free Tier */}
          <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
            <span className={`${styles.pricingBadge} ${styles.pricingBadgeCurrent}`}>Free Tier (Active)</span>
            <div className={styles.pricingCardHeader}>
              <div className={styles.pricingCardName}>Free Developer</div>
              <div className={styles.pricingCardPriceRow}>
                <span className={styles.pricingCardPrice}>$0</span>
                <span className={styles.pricingCardPeriod}>/ forever</span>
              </div>
              <p className={styles.pricingCardDesc}>
                Everything you need to build, test, and ship modern media pipelines.
              </p>
            </div>
            <ul className={styles.pricingCardFeatures}>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span><strong>100 MB</strong> Cloud Media Storage</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>On-The-Fly WebP &amp; AVIF Transcoding</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Smart Center &amp; Face Cropping</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>REST API, Scoped Keys &amp; Webhooks</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Multi-Workspace &amp; Team Collaboration</span>
              </li>
            </ul>
            <div className={styles.pricingCardAction}>
              <Link href={session ? "/" : "/login?mode=sign-up"} className={`${styles.pricingBtn} ${styles.pricingBtnPrimary}`}>
                {session ? "Open Console (100 MB Ready)" : "Get Started Free ➔"}
              </Link>
            </div>
          </div>

          {/* Pro Plan */}
          <div className={styles.pricingCard}>
            <span className={styles.pricingBadge}>Coming Soon</span>
            <div className={styles.pricingCardHeader}>
              <div className={styles.pricingCardName}>Pro Creator</div>
              <div className={styles.pricingCardPriceRow}>
                <span className={styles.pricingCardPrice}>$19</span>
                <span className={styles.pricingCardPeriod}>/ month</span>
              </div>
              <p className={styles.pricingCardDesc}>
                For production applications, ecommerce catalogs, and high-frequency uploads.
              </p>
            </div>
            <ul className={styles.pricingCardFeatures}>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span><strong>50 GB</strong> High-Speed Cloud Storage</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Adaptive Bitrate Video (HLS &amp; DASH)</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Custom CDN Domain &amp; Dedicated SSL</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Priority High-Concurrency Workers</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>90-Day Analytics &amp; Delivery Auditing</span>
              </li>
            </ul>
            <div className={styles.pricingCardAction}>
              <Link href={session ? "/settings" : "/login?mode=sign-up"} className={`${styles.pricingBtn} ${styles.pricingBtnSecondary}`}>
                Join Pro Waitlist
              </Link>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className={styles.pricingCard}>
            <span className={styles.pricingBadge}>Coming Soon</span>
            <div className={styles.pricingCardHeader}>
              <div className={styles.pricingCardName}>Enterprise Scale</div>
              <div className={styles.pricingCardPriceRow}>
                <span className={styles.pricingCardPrice}>Custom</span>
                <span className={styles.pricingCardPeriod}>/ contract</span>
              </div>
              <p className={styles.pricingCardDesc}>
                Dedicated edge clusters, custom SLAs, and custom compliance controls.
              </p>
            </div>
            <ul className={styles.pricingCardFeatures}>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span><strong>Unlimited</strong> Scalable Multi-Cloud Storage</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>99.99% Uptime Enterprise SLA</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>Dedicated Single-Tenant Processing Clusters</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>SAML / SSO &amp; Custom Role Permissions</span>
              </li>
              <li className={styles.pricingCardFeatureItem}>
                <CheckIcon size={16} className={styles.pricingCheckIcon} />
                <span>24/7 Dedicated Solutions Engineer</span>
              </li>
            </ul>
            <div className={styles.pricingCardAction}>
              <a href="mailto:sayalabs.studio@gmail.com?subject=Storinary Enterprise Inquiry" className={`${styles.pricingBtn} ${styles.pricingBtnSecondary}`}>
                Contact Enterprise
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section id="compare" className={styles.compareSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Transparent Comparison</span>
          <h2 className={styles.sectionTitle}>Storinary vs. The Giants</h2>
          <p className={styles.sectionSubtitle}>
            Why pay exorbitant monthly subscription fees when you can own your delivery pipeline?
          </p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col" className={styles.storinaryCol}><ZapIcon size={13} /> Storinary</th>
                <th scope="col">Cloudinary</th>
                <th scope="col">Cloudflare Images</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Monthly Cost</strong></td>
                <td className={styles.storinaryCol}><strong>$0.00 Forever</strong></td>
                <td>$99+ / month</td>
                <td>$5/mo + $1/1k images</td>
              </tr>
              <tr>
                <td><strong>Bandwidth Allowance</strong></td>
                <td className={styles.storinaryCol}><strong>Unlimited (via Cloudflare)</strong></td>
                <td>25 GB free cap</td>
                <td>Usage metered</td>
              </tr>
              <tr>
                <td><strong>Credit Card Required</strong></td>
                <td className={styles.storinaryCol}><strong>NO (Strictly $0)</strong></td>
                <td>Required for scale</td>
                <td>Required</td>
              </tr>
              <tr>
                <td><strong>URL Compatibility</strong></td>
                <td className={styles.storinaryCol}><strong>Native Cloudinary Syntax</strong></td>
                <td>Native</td>
                <td>Proprietary</td>
              </tr>
              <tr>
                <td><strong>Workspaces & Teams</strong></td>
                <td className={styles.storinaryCol}><strong>Unlimited Organizations</strong></td>
                <td>1 workspace</td>
                <td>1 account</td>
              </tr>
              <tr>
                <td><strong>Self-Hosted Ownership</strong></td>
                <td className={styles.storinaryCol}><strong>100% Open Source (GPL-3)</strong></td>
                <td>Closed proprietary</td>
                <td>Proprietary cloud</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBox}>
          <h2 className={styles.ctaTitle}>Ready to Cut Your Cloud Bills to $0?</h2>
          <p className={styles.ctaSubtitle}>
            Deploy Storinary in 5 minutes with zero credit card required. Connect your Appwrite or
            Supabase storage and start delivering images today.
          </p>
          <Link href="/login?mode=sign-up" className={styles.ctaButton}>
            Get Started Free ➔
          </Link>
        </div>
      </section>
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogo}>STORINARY BY SAYALABS</span>
            <span className={styles.footerCopy}>
              Engineered by Anurag Mishra • Studio Sayalabs. Licensed under GPL-3.0.
            </span>
          </div>

          <div className={styles.footerLinks}>
            <Link href="/login" className={styles.footerLink}>
              Sign In
            </Link>
            <Link href="/login?mode=sign-up" className={styles.footerLink}>
              Create Account
            </Link>
            <a
              href="https://github.com/anurag3407/storinary-cloud"
              target="_blank"
              rel="noreferrer"
              className={styles.footerLink}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
