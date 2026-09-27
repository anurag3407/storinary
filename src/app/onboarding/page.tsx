'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import styles from '@/app/login/login.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  useEffect(() => {
    void (async () => {
      const session = await authClient.getSession();
      if (!session.data) { router.replace('/login?next=/onboarding'); return; }
      const result = await authClient.organization.list();
      setOrganizations((result.data ?? []) as typeof organizations);
      setLoading(false);
    })();
  }, [router]);

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(null);
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const result = await authClient.organization.create({ name: name.trim(), slug });
    if (result.error) { setError(result.error.message || 'Could not create organization'); setLoading(false); return; }
    const created = result.data as { id?: string } | undefined;
    if (created?.id) await authClient.organization.setActive({ organizationId: created.id });
    router.replace('/');
  };

  if (loading && !organizations.length) return <main className={styles.mainGrid}><p>Loading workspaces…</p></main>;
  return <main className={styles.mainGrid}><form className={styles.card} onSubmit={createOrganization}>
    <h1 className={styles.cardTitle}>Choose a workspace</h1>
    <p className={styles.cardSubtitle}>Each organization has its own assets, folders, transforms, keys, analytics, and delivery namespace.</p>
    {organizations.length > 0 && <div className={styles.warning}>{organizations.map((org) => <button type="button" key={org.id} onClick={async () => { await authClient.organization.setActive({ organizationId: org.id }); router.replace('/'); }}>{org.name}</button>)}</div>}
    <div className={styles.formGroup}><label className={styles.label} htmlFor="workspace">New organization</label><input id="workspace" className={`nb-input ${styles.input}`} value={name} onChange={(e) => setName(e.target.value)} required /></div>
    {error && <div className={styles.errorBanner}>{error}</div>}
    <Button type="submit" fullWidth loading={loading}>Create workspace</Button>
    <Button type="button" fullWidth onClick={async () => { await authClient.signOut(); router.replace('/login'); }}>Sign out</Button>
  </form></main>;
}
