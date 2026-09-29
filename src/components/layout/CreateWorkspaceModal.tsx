'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { authClient } from '@/lib/auth-client';
import { useAppAuth } from '@/components/auth/AuthProvider';
import { SparklesIcon, AlertIcon } from '@/components/ui/icons';
import styles from './CreateWorkspaceModal.module.css';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (org: { id: string; name: string; slug: string }) => void;
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreated }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createOrganization, isClerk } = useAppAuth();

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const finalSlug = slug || generateSlug(name);
    if (!finalSlug) {
      setError('Please provide a valid workspace slug');
      setLoading(false);
      return;
    }

    try {
      if (isClerk) {
        const created = await createOrganization({ name: name.trim(), slug: finalSlug });
        if (created) {
          if (onCreated) {
            onCreated(created);
          } else {
            window.location.reload();
          }
          onClose();
          return;
        } else {
          setError('Failed to create workspace with Clerk');
          setLoading(false);
          return;
        }
      }

      const result = await authClient.organization.create({
        name: name.trim(),
        slug: finalSlug,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to create workspace');
        setLoading(false);
        return;
      }

      const created = result.data as { id?: string; name?: string; slug?: string } | undefined;
      if (created?.id) {
        await authClient.organization.setActive({ organizationId: created.id });
        if (onCreated) {
          onCreated({ id: created.id, name: created.name || name.trim(), slug: created.slug || finalSlug });
        } else {
          window.location.reload();
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Organization"
      actions={
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            icon={<SparklesIcon size={16} />}
            loading={loading}
            onClick={() => {
              void handleSubmit();
            }}
          >
            Create Workspace
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.introBox}>
          <p>
            <strong>What is a Workspace?</strong> Each organization has its own isolated assets,
            custom folders, team members, API keys, and dedicated CDN URLs. Includes <strong>100 MB complimentary cloud storage</strong> on the Free Developer Tier.
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="org-name">
            Organization / Brand Name
          </label>
          <input
            id="org-name"
            type="text"
            className={styles.input}
            placeholder="e.g. Acme Studio, Personal, Client Alpha"
            value={name}
            onChange={handleNameChange}
            required
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="org-slug">
            Cloud Name (URL Slug)
          </label>
          <input
            id="org-slug"
            type="text"
            className={styles.input}
            placeholder="e.g. acme-studio"
            value={slug}
            onChange={handleSlugChange}
            required
          />
        </div>

        {slug && (
          <div className={styles.previewBox}>
            <span className={styles.previewLabel}>Public Delivery Namespace Preview</span>
            <span className={styles.previewCode}>/api/serve/{slug}/your-image.webp</span>
          </div>
        )}

        {error && <div className={styles.errorBanner}><AlertIcon size={15} /> {error}</div>}
      </form>
    </Modal>
  );
}
