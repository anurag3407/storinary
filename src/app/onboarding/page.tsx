'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useAppAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { SparklesIcon, AlertIcon, BulbIcon } from '@/components/ui/icons';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const {
    isLoaded: authLoaded,
    isSignedIn,
    organizations: authOrgs,
    createOrganization: authCreateOrg,
    setActiveOrganization: authSetActiveOrg,
    signOut: authSignOut,
    isClerk,
  } = useAppAuth();

  useEffect(() => {
    if (isClerk) {
      if (authLoaded) {
        if (!isSignedIn) {
          router.replace('/login?next=/onboarding');
          return;
        }
        setOrganizations(authOrgs);
        setLoading(false);
      }
      return;
    }

    void (async () => {
      try {
        const session = await authClient.getSession();
        if (!session.data) {
          router.replace('/login?next=/onboarding');
          return;
        }
        const result = await authClient.organization.list();
        setOrganizations((result.data ?? []) as typeof organizations);
      } catch (err) {
        console.error('Failed to load session/organizations:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, isClerk, authLoaded, isSignedIn, authOrgs]);

  const generateSlug = (val: string) => {
    return val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isManualSlug) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualSlug(true);
    setSlug(generateSlug(e.target.value));
  };

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);

    const finalSlug = slug || generateSlug(name);
    if (!finalSlug) {
      setError('Please provide a valid workspace slug');
      setCreating(false);
      return;
    }

    try {
      if (isClerk) {
        const created = await authCreateOrg({ name: name.trim(), slug: finalSlug });
        if (created) {
          router.replace('/');
          return;
        } else {
          setError('Could not create workspace with Clerk');
          setCreating(false);
          return;
        }
      }

      const result = await authClient.organization.create({
        name: name.trim(),
        slug: finalSlug,
      });

      if (result.error) {
        setError(result.error.message || 'Could not create organization');
        setCreating(false);
        return;
      }

      const created = result.data as { id?: string } | undefined;
      if (created?.id) {
        await authClient.organization.setActive({ organizationId: created.id });
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setCreating(false);
    }
  };

  const handleSelectExisting = async (orgId: string) => {
    setLoading(true);
    try {
      if (isClerk) {
        await authSetActiveOrg(orgId);
        router.replace('/');
        return;
      }

      await authClient.organization.setActive({ organizationId: orgId });
      router.replace('/');
    } catch {
      setError('Failed to switch workspace');
      setLoading(false);
    }
  };

  if (loading && !organizations.length) {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <p>Loading your workspaces…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Image
            src="/logo.png"
            alt="Storinary"
            width={48}
            height={48}
            className={styles.logoMark}
            priority
          />
          <h1 className={styles.title}>Welcome to Storinary</h1>
          <p className={styles.subtitle}>
            Set up or select a workspace to manage your media library, transforms, and CDN delivery.
          </p>
        </div>

        <div className={styles.infoBox}>
          <BulbIcon size={15} /> <strong>What is a Workspace?</strong> Workspaces isolate your uploaded assets, folders,
          team members, and CDN URL namespace. Each workspace receives <strong>100 MB complimentary storage</strong> on the Free Developer Tier.
        </div>

        {organizations.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Your Existing Workspaces</span>
            <div className={styles.orgList}>
              {organizations.map((org) => (
                <button
                  type="button"
                  key={org.id}
                  className={styles.orgItem}
                  onClick={() => handleSelectExisting(org.id)}
                >
                  <div>
                    <span className={styles.orgName}>{org.name}</span>
                    <span className={styles.orgSlug}>{org.slug}</span>
                  </div>
                  <span className={styles.enterBtn}>Enter Workspace →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {organizations.length > 0 && <div className={styles.divider}>or create new</div>}

        <form className={styles.form} onSubmit={createOrganization}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="workspace-name">
              New Workspace Name
            </label>
            <input
              id="workspace-name"
              className={styles.input}
              placeholder="e.g. Acme Studio, Personal, Client Alpha"
              value={name}
              onChange={handleNameChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="workspace-slug">
              Cloud Name (URL Slug)
            </label>
            <input
              id="workspace-slug"
              className={styles.input}
              placeholder="e.g. acme-studio"
              value={slug}
              onChange={handleSlugChange}
              required
            />
          </div>

          {slug && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>Your Public Delivery Namespace</span>
              <span className={styles.previewCode}>/api/serve/{slug}/image.webp</span>
            </div>
          )}

          {error && <div className={styles.errorBanner}><AlertIcon size={15} /> {error}</div>}

          <Button type="submit" fullWidth loading={creating} icon={<SparklesIcon size={16} />}>
            Create Workspace
          </Button>
        </form>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.signOutBtn}
            onClick={async () => {
              await authSignOut();
            }}
          >
            Sign out of this account
          </button>
        </div>
      </div>
    </main>
  );
}
