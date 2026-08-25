'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { CompressionSelector } from '@/components/upload/CompressionSelector';
import {
  DEFAULT_UPLOAD_OPTIONS,
  loadUploadDefaults,
  saveUploadDefaults,
  type UploadDefaults,
} from '@/lib/upload-helpers';
import type { StatsResponse } from '@/types';
import styles from './settings.module.css';

const BACKBLAZE_SETUP_STEPS = [
  {
    title: 'Create a Backblaze account',
    detail:
      'Go to backblaze.com/b2 and create a free B2 Cloud Storage account (10 GB free storage included).',
  },
  {
    title: 'Create the storage bucket',
    detail:
      'In the Backblaze B2 dashboard, go to Buckets → Create a Bucket. Enter a unique bucket name (e.g. "storinary"), and set "Files in Bucket are" to Public.',
  },
  {
    title: 'Create an Application Key',
    detail:
      'Go to App Keys → Add a New Application Key. Name it (e.g. "storinary-key"), select "Read and Write" access, and copy the keyID and applicationKey.',
  },
  {
    title: 'Update your .env file',
    detail:
      'Paste the credentials into .env as BACKBLAZE_APPLICATION_KEY_ID, BACKBLAZE_APPLICATION_KEY, and BACKBLAZE_BUCKET_NAME. Restart the dev server.',
  },
];

const SUPABASE_SETUP_STEPS = [
  {
    title: 'Create a Supabase project',
    detail:
      'Go to supabase.com and create a free project (no credit card required). Note your project URL.',
  },
  {
    title: 'Create the storage bucket',
    detail:
      'In the Supabase dashboard, open Storage → New bucket. Name it exactly "storinary" (or your SUPABASE_BUCKET_NAME).',
  },
  {
    title: 'Make the bucket public',
    detail:
      'While creating (or editing) the bucket, toggle "Public bucket" ON. This gives you auto-generated CDN URLs.',
  },
  {
    title: 'Copy your API keys',
    detail:
      'Open Project Settings → API. Copy the Project URL, anon key, and service_role key. The service role key stays server-side only.',
  },
  {
    title: 'Update your .env file',
    detail:
      'Paste the values into .env as NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET_NAME. Restart the dev server.',
  },
];

const APPWRITE_SETUP_STEPS = [
  {
    title: 'Create an Appwrite project',
    detail:
      'Go to cloud.appwrite.io and create a project (use your GitHub Student Developer Pack / Student Offer for free Pro tier). Note your Project ID and API Endpoint.',
  },
  {
    title: 'Create the storage bucket',
    detail:
      'In the Appwrite dashboard, open Storage → Create Bucket. Name it and set Bucket ID to "storinary" (or your APPWRITE_BUCKET_ID).',
  },
  {
    title: 'Configure bucket permissions',
    detail:
      'In the bucket Settings → Permissions, add "Any" with "Read" access (or configure file permissions) so generated CDN URLs are publicly accessible.',
  },
  {
    title: 'Generate an API key',
    detail:
      'Open Project Settings → API Keys → Create API Key. Grant Storage scopes (files.read, files.write) and copy the secret key.',
  },
  {
    title: 'Update your .env file',
    detail:
      'Paste the values into .env as NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_BUCKET_ID. Restart the dev server.',
  },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [authStatus, setAuthStatus] = useState<
    'checking' | 'on' | 'off'
  >('checking');
  const [connection, setConnection] = useState<
    'checking' | 'connected' | 'disconnected'
  >('checking');
  const [provider, setProvider] = useState<'backblaze' | 'appwrite' | 'supabase'>('supabase');
  const [providerName, setProviderName] = useState('Supabase Storage');
  const [storageEndpoint, setStorageEndpoint] = useState('');
  const [bucket, setBucket] = useState('');

  const [options, setOptions] = useState<UploadDefaults>(DEFAULT_UPLOAD_OPTIONS);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'backblaze' | 'appwrite' | 'supabase'>('backblaze');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const testConnection = async (silent = false) => {
    setConnection('checking');
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error('Request failed');
      const data: StatsResponse = await res.json();
      setConnection('connected');
      if (data.provider) setProvider(data.provider);
      if (data.providerName) setProviderName(data.providerName);
      if (data.storageEndpoint) setStorageEndpoint(data.storageEndpoint);
      setBucket(data.storageBucket || data.supabaseBucket || '');
      if (data.provider) setActiveGuideTab(data.provider);
      if (!silent) toast.success(`Connected to ${data.providerName || 'Storage'}!`);
    } catch {
      setConnection('disconnected');
      if (!silent) toast.error('Connection failed');
    }
  };

  // Load saved defaults and test connection on mount (silently)
  useEffect(() => {
    setOptions(loadUploadDefaults());
    testConnection(true);
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => setAuthStatus(data?.enabled ? 'on' : 'off'))
      .catch(() => setAuthStatus('off'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDefaults = () => {
    try {
      saveUploadDefaults(options);
      toast.success('Default upload settings saved');
    } catch {
      toast.error('Could not save settings');
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      // Fetch all image IDs (paginated, up to 100 per page)
      const allIds: string[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await fetch(`/api/images?limit=100&page=${page}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to fetch image list');
        const data = await res.json();
        allIds.push(...data.images.map((i: { id: string }) => i.id));
        totalPages = data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      // Delete in chunks of 100 (API limit)
      let deleted = 0;
      for (let i = 0; i < allIds.length; i += 100) {
        const chunk = allIds.slice(i, i + 100);
        if (chunk.length === 0) continue;
        const res = await fetch('/api/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk }),
        });
        if (!res.ok) throw new Error('Bulk delete failed');
        const data = await res.json();
        if (data.success === false) {
          throw new Error(data.errors?.[0]?.error || 'Storage delete failed');
        }
        deleted += data.deleted || 0;
      }

      toast.success(`Deleted ${deleted} image(s)`);
      setConfirmDelete(false);
      setDeleteInput('');
    } catch {
      toast.error('Failed to delete images');
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/reset', { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
      toast.success('Database reset — storage files kept');
      setConfirmReset(false);
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const deleteConfirmed = deleteInput.trim().toUpperCase() === 'DELETE ALL';

  return (
    <div>
      <Header
        title="Settings"
        description="Configure your storage provider (Backblaze / Appwrite / Supabase) and default upload options."
      />

      <div className={styles.grid}>
        {/* ── Section 0: Authentication ───────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Authentication</h2>
          <p className={styles.cardDescription}>
            Session-based admin login protects uploads, deletes, and settings.
            Configure <code>STORINARY_ADMIN_PASSWORD</code> to enable it.
          </p>

          <div className={styles.statusRow}>
            <Badge
              variant={
                authStatus === 'on'
                  ? 'success'
                  : authStatus === 'off'
                    ? 'warning'
                    : 'default'
              }
            >
              {authStatus === 'checking'
                ? 'CHECKING…'
                : authStatus === 'on'
                  ? 'ENABLED'
                  : 'DISABLED (DEV MODE)'}
            </Badge>
            {authStatus === 'on' && (
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            )}
          </div>
        </section>

        {/* ── Section 1: Connection Status ─────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Connection Status</h2>
          <p className={styles.cardDescription}>
            Verify that Storinary can reach your configured storage bucket.
          </p>

          <div className={styles.statusRow}>
            <Badge
              variant={
                connection === 'connected'
                  ? 'success'
                  : connection === 'disconnected'
                    ? 'danger'
                    : 'default'
              }
            >
              {connection === 'connected'
                ? 'CONNECTED'
                : connection === 'disconnected'
                  ? 'DISCONNECTED'
                  : 'CHECKING…'}
            </Badge>
            <Badge variant="default">
              {provider === 'backblaze'
                ? 'BACKBLAZE B2'
                : provider === 'appwrite'
                  ? 'APPWRITE'
                  : 'SUPABASE'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={testConnection}
              loading={connection === 'checking'}
            >
              Test Connection
            </Button>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Active Provider</span>
              <span className={styles.infoValue}>{providerName}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>
                {provider === 'backblaze'
                  ? 'Backblaze Endpoint / CDN'
                  : provider === 'appwrite'
                    ? 'Appwrite Endpoint'
                    : 'Supabase URL'}
              </span>
              <span className={styles.infoValue}>
                {storageEndpoint || 'Not set'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Bucket Name / ID</span>
              <span className={styles.infoValue}>{bucket || 'Not set'}</span>
            </div>
          </div>
        </section>

        {/* ── Section 2: Default Upload Settings ───────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Default Upload Settings</h2>
          <p className={styles.cardDescription}>
            These defaults are applied to every new upload. Stored locally in
            your browser.
          </p>

          <div className={styles.form}>
            <label className="nb-checkbox">
              <input
                type="checkbox"
                checked={options.compress}
                onChange={(e) =>
                  setOptions({ ...options, compress: e.target.checked })
                }
              />
              Compress to WebP
            </label>

            {options.compress && (
              <>
                <CompressionSelector
                  idPrefix="settings"
                  quality={options.quality}
                  onChange={(quality) =>
                    setOptions({
                      ...options,
                      quality,
                    })
                  }
                />

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="settings-maxwidth">
                    Max Width
                  </label>
                  <div className={styles.inputGroup}>
                    <input
                      id="settings-maxwidth"
                      className="nb-input"
                      type="number"
                      value={options.maxWidth}
                      step="128"
                      min="128"
                      max="8192"
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          maxWidth: parseInt(e.target.value, 10) || 2048,
                        })
                      }
                    />
                    <span className={styles.suffix}>px</span>
                  </div>
                </div>
              </>
            )}

            <label className="nb-checkbox">
              <input
                type="checkbox"
                checked={options.removeBg}
                onChange={(e) =>
                  setOptions({ ...options, removeBg: e.target.checked })
                }
              />
              Remove Background
            </label>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-folder">
                Default Folder
              </label>
              <div className={styles.inputGroup}>
                <span className={styles.prefix}>/</span>
                <input
                  id="settings-folder"
                  className="nb-input"
                  type="text"
                  value={
                    options.folder === '/'
                      ? ''
                      : options.folder.replace(/^\/+/, '')
                  }
                  placeholder="folder/path"
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      folder: e.target.value
                        ? `/${e.target.value.replace(/^\/+|\/+$/g, '')}`
                        : '/',
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-tags">
                Default Tags
              </label>
              <input
                id="settings-tags"
                className="nb-input"
                type="text"
                value={options.tags}
                placeholder="comma, separated, tags"
                onChange={(e) =>
                  setOptions({ ...options, tags: e.target.value })
                }
              />
            </div>
          </div>

          <div className={styles.saveRow}>
            <Button variant="primary" onClick={saveDefaults}>
              Save Defaults
            </Button>
          </div>
        </section>

        {/* ── Section 3: Storage Setup Guide ───────────────── */}
        <section className={styles.card}>
          <button
            type="button"
            className={styles.guideToggle}
            onClick={() => setGuideOpen((o) => !o)}
            aria-expanded={guideOpen}
          >
            <span>Storage Provider Setup Instructions</span>
            <span className={styles.guideChevron} aria-hidden="true">
              {guideOpen ? '▼' : '▶'}
            </span>
          </button>

          {guideOpen && (
            <div>
              <div className={styles.guideTabs}>
                <button
                  type="button"
                  className={`${styles.guideTab} ${activeGuideTab === 'backblaze' ? styles.guideTabActive : ''}`}
                  onClick={() => setActiveGuideTab('backblaze')}
                >
                  ⚡ Backblaze B2 (10 GB Free)
                </button>
                <button
                  type="button"
                  className={`${styles.guideTab} ${activeGuideTab === 'appwrite' ? styles.guideTabActive : ''}`}
                  onClick={() => setActiveGuideTab('appwrite')}
                >
                  ⚡ Appwrite (Student Offer / Pro)
                </button>
                <button
                  type="button"
                  className={`${styles.guideTab} ${activeGuideTab === 'supabase' ? styles.guideTabActive : ''}`}
                  onClick={() => setActiveGuideTab('supabase')}
                >
                  ⚡ Supabase Storage
                </button>
              </div>

              <ol className={styles.guideList}>
                {(activeGuideTab === 'backblaze'
                  ? BACKBLAZE_SETUP_STEPS
                  : activeGuideTab === 'appwrite'
                    ? APPWRITE_SETUP_STEPS
                    : SUPABASE_SETUP_STEPS
                ).map((step, i) => (
                  <li key={step.title} className={styles.guideItem}>
                    <span className={styles.guideNumber}>{i + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* ── Section 4: Danger Zone ───────────────────────── */}
        <section className={`${styles.card} ${styles.danger}`}>
          <h2 className={`${styles.cardTitle} ${styles.dangerTitle}`}>
            Danger Zone
          </h2>

          <div className={styles.dangerRow}>
            <div>
              <h3 className={styles.dangerActionTitle}>Delete All Images</h3>
              <p className={styles.dangerActionDesc}>
                Permanently removes every image from both storage and the
                database. This cannot be undone.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete All Images
            </Button>
          </div>

          <div className={styles.dangerRow}>
            <div>
              <h3 className={styles.dangerActionTitle}>Reset Database</h3>
              <p className={styles.dangerActionDesc}>
                Deletes all database records but keeps the files in your storage
                bucket. Useful for re-syncing.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset Database
            </Button>
          </div>
        </section>
      </div>

      {/* ── Delete All Confirmation Modal ─────────────────── */}
      <Modal
        isOpen={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteInput('');
        }}
        title="Delete all images?"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(false);
                setDeleteInput('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              loading={deleting}
              disabled={!deleteConfirmed}
            >
              {deleting ? 'Deleting…' : 'Delete Everything'}
            </Button>
          </>
        }
      >
        <p>
          This will permanently delete <strong>every image</strong> from
          storage and the gallery. This action cannot be undone.
        </p>
        <p className={styles.modalHint}>
          Type <strong>DELETE ALL</strong> to confirm.
        </p>
        <input
          className="nb-input"
          type="text"
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          placeholder="DELETE ALL"
          autoFocus
        />
      </Modal>

      {/* ── Reset Confirmation Modal ──────────────────────── */}
      <Modal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset database?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReset} loading={resetting}>
              {resetting ? 'Resetting…' : 'Reset Database'}
            </Button>
          </>
        }
      >
        <p>
          This deletes all <strong>database records</strong> but keeps the
          files in your storage bucket. You can re-sync the library later. This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
