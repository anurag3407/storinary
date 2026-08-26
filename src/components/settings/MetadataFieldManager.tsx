'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import type { MetadataFieldRecord } from '@/lib/structured-metadata';
import styles from '../../app/settings/settings.module.css';

const FIELD_TYPES = ['string', 'integer', 'boolean', 'enum'] as const;

export function MetadataFieldManager() {
  const { addToast } = useToast();
  const [fields, setFields] = useState<MetadataFieldRecord[]>([]);
  const [externalId, setExternalId] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<MetadataFieldRecord['type']>('string');
  const [allowedValues, setAllowedValues] = useState('');
  const [required, setRequired] = useState(false);
  const hasMutatedRef = useRef(false);

  const loadFields = useCallback(async (): Promise<MetadataFieldRecord[] | null> => {
    try {
      const response = await fetch('/api/metadata-fields', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      return (await response.json()).fields ?? [];
    } catch {
      addToast({ message: 'Could not load metadata fields', type: 'error' });
      return null;
    }
  }, [addToast]);

  useEffect(() => {
    let cancelled = false;
    void loadFields().then((loaded) => {
      if (!cancelled && loaded && !hasMutatedRef.current) {
        setFields(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadFields]);

  async function createField() {
    try {
      hasMutatedRef.current = true;
      const response = await fetch('/api/metadata-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          label,
          type,
          required,
          allowedValues,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create field');
      setFields((current) => [...current, data.field].sort(
        (left, right) => left.externalId.localeCompare(right.externalId)
      ));
      setExternalId('');
      setLabel('');
      setType('string');
      setAllowedValues('');
      setRequired(false);
      addToast({ message: 'Metadata field created', type: 'success' });
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Unable to create metadata field',
        type: 'error',
      });
    }
  }

  async function deleteField(id: string) {
    try {
      hasMutatedRef.current = true;
      const response = await fetch(`/api/metadata-fields/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setFields((current) => current.filter((field) => field.id !== id));
      addToast({ message: 'Metadata field deleted', type: 'success' });
    } catch {
      addToast({ message: 'Could not delete metadata field', type: 'error' });
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Structured Metadata</h2>
      <p className={styles.cardDescription}>
        Define searchable DAM fields for campaigns, rights, approval state, and
        custom workflows. Values are validated on every media update.
      </p>

      <div className={styles.presetCreator}>
        <input aria-label="Metadata field ID" className="nb-input" placeholder="campaign_code" value={externalId} onChange={(event) => setExternalId(event.target.value)} />
        <input aria-label="Metadata label" className="nb-input" placeholder="Campaign code" value={label} onChange={(event) => setLabel(event.target.value)} />
        <select aria-label="Metadata type" className="nb-select" value={type} onChange={(event) => setType(event.target.value as MetadataFieldRecord['type'])}>
          {FIELD_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <input aria-label="Allowed metadata values" className="nb-input" placeholder="spring, fall (enum only)" value={allowedValues} disabled={type !== 'enum'} onChange={(event) => setAllowedValues(event.target.value)} />
        <label className="nb-checkbox">
          <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
          Required
        </label>
        <Button onClick={() => void createField()} disabled={!externalId.trim() || !label.trim()}>Create</Button>
      </div>

      <div className={styles.keyList}>
        {fields.map((field) => (
          <div key={field.id} className={styles.keyRow}>
            <div>
              <strong>{field.label}</strong>
              <small>{`metadata.${field.externalId} · ${field.type}${field.required ? ' · required' : ''}${field.allowedValues.length ? ` · ${field.allowedValues.join(', ')}` : ''}`}</small>
            </div>
            <div className={styles.statusRow}>
              <Badge variant={field.active ? 'success' : 'default'}>{field.active ? 'Active' : 'Paused'}</Badge>
              <Button variant="danger" size="sm" onClick={() => void deleteField(field.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
