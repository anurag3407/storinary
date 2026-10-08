'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useAppAuth } from '@/components/auth/AuthProvider';
import { UserButton } from '@clerk/nextjs';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { type IconProps, DashboardIcon, ImageIcon, SettingsIcon, SparklesIcon, UploadIcon, VideoIcon } from '@/components/ui/icons';
import type { StatsResponse } from '@/types';
import styles from './Sidebar.module.css';

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: (props: IconProps) => React.JSX.Element;
}> = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/upload', label: 'Upload', icon: UploadIcon },
  { href: '/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/videos', label: 'Videos', icon: VideoIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const {
    organizations: authOrgs,
    activeOrganizationId: authActiveOrgId,
    setActiveOrganization,
    isClerk,
  } = useAppAuth();

  // Toggle from Header hamburger (mobile)
  useEffect(() => {
    const handler = () => setIsOpen((o) => !o);
    window.addEventListener('storinary:toggle-sidebar', handler);
    return () => window.removeEventListener('storinary:toggle-sidebar', handler);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Let the header's toggle button reflect the real open/closed state.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('storinary:sidebar-state', { detail: { open: isOpen } })
    );
  }, [isOpen]);

  // Load organizations for workspace selector
  useEffect(() => {
    if (isClerk) {
      if (authOrgs && authOrgs.length > 0) {
        setOrganizations(authOrgs);
      }
      if (authActiveOrgId) {
        setActiveOrgId(authActiveOrgId);
      }
      return;
    }

    void (async () => {
      try {
        const [orgsRes, sessionRes] = await Promise.all([
          authClient.organization.list(),
          authClient.getSession(),
        ]);
        if (orgsRes.data) {
          setOrganizations(orgsRes.data as Array<{ id: string; name: string; slug: string }>);
        }
        const currentActive = (sessionRes.data?.session as { activeOrganizationId?: string | null })?.activeOrganizationId;
        if (currentActive) {
          setActiveOrgId(currentActive);
        }
      } catch {
        /* auth unavailable */
      }
    })();
  }, [pathname, isClerk, authOrgs, authActiveOrgId]);

  const handleSelectWorkspace = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      setIsCreateModalOpen(true);
      return;
    }
    if (val && val !== activeOrgId) {
      try {
        if (isClerk) {
          await setActiveOrganization(val);
        } else {
          await authClient.organization.setActive({ organizationId: val });
          setActiveOrgId(val);
          window.location.reload();
        }
      } catch (err) {
        console.error('Failed to switch workspace:', err);
      }
    }
  };

  const lastStatsFetchRef = useRef<number>(0);

  // Fetch real storage stats on navigation and on quota update events with 15s throttle
  useEffect(() => {
    const fetchStats = (force = false) => {
      const now = Date.now();
      if (!force && lastStatsFetchRef.current > 0 && now - lastStatsFetchRef.current < 15_000) {
        return;
      }
      lastStatsFetchRef.current = now;
      fetch('/api/stats')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setStats(data);
          }
        })
        .catch(() => {
          /* stats unavailable */
        });
    };

    fetchStats();

    const handleQuotaUpdated = () => fetchStats(true);
    const handleOpenUpgrade = () => setIsUpgradeModalOpen(true);

    window.addEventListener('storinary:quota-updated', handleQuotaUpdated);
    window.addEventListener('storinary:open-upgrade', handleOpenUpgrade);

    return () => {
      window.removeEventListener('storinary:quota-updated', handleQuotaUpdated);
      window.removeEventListener('storinary:open-upgrade', handleOpenUpgrade);
    };
  }, [pathname]);

  // Hide sidebar on standalone landing / login / onboarding page
  const isStandalone =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/landing' ||
    pathname.startsWith('/accept-invitation');

  if (isStandalone) {
    return null;
  }

  const usedFormatted = stats?.totalStorageFormatted || '0 B';
  const limitFormatted = stats?.storageLimitFormatted || '100 MB';
  const pct = stats?.storagePercentage ?? 0;

  return (
    <>
      {isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}
      <aside
        id="app-sidebar"
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
        aria-label="Workspace navigation"
      >
        <Link href="/" className={styles.logo} onClick={() => setIsOpen(false)}>
          <Image
            src="/logo.png"
            alt="Storinary Mark"
            width={38}
            height={38}
            className={styles.logoMark}
            priority
          />
          <div className={styles.logoBrand}>
            <span className={styles.logoTitle}>STORINARY</span>
            <span className={styles.logoSub}>BY SAYALABS</span>
          </div>
        </Link>

        <div className={styles.workspaceSelector}>
          <div className={styles.workspaceHeader}>
            <span className={styles.workspaceLabel}>Workspace</span>
            <button
              type="button"
              className={styles.workspaceNewBtn}
              onClick={() => setIsCreateModalOpen(true)}
              title="Create new workspace"
            >
              + New
            </button>
          </div>
          {organizations.length > 0 ? (
            <select
              aria-label="Select workspace"
              className={styles.workspaceSelect}
              value={activeOrgId}
              onChange={handleSelectWorkspace}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
              <option value="__new__">+ Create Workspace</option>
            </select>
          ) : (
            <button
              type="button"
              className={styles.createWorkspacePrompt}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <span className={styles.createWorkspaceIcon}>
                <SparklesIcon size={16} />
              </span>{' '}
              Create Workspace
            </button>
          )}
        </div>

        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(org) => {
            setOrganizations((prev) => [...prev, org]);
            setActiveOrgId(org.id);
            window.location.reload();
          }}
        />

        <div className={styles.navSectionLabel}>Platform</div>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  <item.icon size={19} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isClerk && (
          <div className={styles.userArea}>
            <UserButton showName />
          </div>
        )}

        <div className={styles.storageBox}>
          <div className={styles.storageHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={styles.storageLabel}>PLAN</span>
              <span className={styles.planBadge}>
                {stats?.planName?.toUpperCase().includes('PRO') ? 'PRO TIER' : 'FREE TIER'}
              </span>
            </div>
            {!stats?.planName?.toUpperCase().includes('PRO') && (
              <button
                type="button"
                className={styles.upgradeBtn}
                onClick={() => setIsUpgradeModalOpen(true)}
                title="Upgrade storage plan"
              >
                Upgrade
              </button>
            )}
          </div>
          <span className={styles.storageValue}>
            {usedFormatted} / {limitFormatted}
          </span>
          <div
            className={styles.storageBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`${styles.storageFill} ${
                pct >= 100
                  ? styles.storageFillDanger
                  : pct >= 80
                    ? styles.storageFillWarning
                    : ''
              }`}
              style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--ui-text-subtle)' }}>
              {pct >= 100 ? 'Quota Reached' : pct >= 80 ? 'Approaching Limit' : `${limitFormatted} Limit`}
            </span>
            <span className={styles.storageSub} style={{ margin: 0 }}>{pct}%</span>
          </div>
        </div>

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          currentUsageFormatted={usedFormatted}
          planName={stats?.planName}
        />
      </aside>
    </>
  );
}
