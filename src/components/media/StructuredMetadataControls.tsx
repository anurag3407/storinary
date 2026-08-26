'use client';

import { useState } from 'react';
import type { MetadataFieldRecord } from '@/lib/structured-metadata';
import styles from './StructuredMetadataControls.module.css';

interface StructuredMetadataControlsProps {
  fields: MetadataFieldRecord[];
  metadata: Record<string, string> | undefined;
  savingExternalId: string | null;
  onSave: (externalId: string, value: string) => void | Promise<void>;
}

export function StructuredMetadataControls({
  fields,
  metadata,
  savingExternalId,
  onSave,
}: StructuredMetadataControlsProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  if (fields.length === 0) return null;

  const updateDraft = (externalId: string, value: string) => {
    setDraftValues((current) => ({ ...current, [externalId]: value }));
  };

  return (
    <div className={styles.grid}>
      {fields.map((field) => {
        const currentValue = metadata?.[field.externalId] ?? '';
        const draftValue = draftValues[field.externalId];
        const value = draftValue ?? currentValue;

        if (field.type === 'enum' || field.type === 'boolean') {
          return (
            <select
              key={field.id}
              aria-label={field.label}
              className="nb-select"
              disabled={savingExternalId === field.externalId}
              value={value}
              onChange={(event) => void onSave(field.externalId, event.target.value)}
            >
              <option value="">—</option>
              {field.type === 'enum' ? field.allowedValues.map((option) => (
                <option key={option} value={option}>{option}</option>
              )) : (
                <>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </>
              )}
            </select>
          );
        }

        return (
          <input
            key={field.id}
            aria-label={field.label}
            className="nb-input"
            type={field.type === 'integer' ? 'number' : 'text'}
            defaultValue={currentValue}
            disabled={savingExternalId === field.externalId}
            onBlur={(event) => {
              if (event.target.value !== currentValue) {
                void onSave(field.externalId, event.target.value);
              }
            }}
            onChange={(event) => updateDraft(field.externalId, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        );
      })}
    </div>
  );
}
