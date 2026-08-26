'use client';

import { useEffect, useState } from 'react';
import type { MetadataFieldRecord } from '@/lib/structured-metadata';

export function useMetadataFields() {
  const [fields, setFields] = useState<MetadataFieldRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/metadata-fields', { cache: 'no-store' });
        if (!response?.ok) return;
        const data = await response.json();
        if (!cancelled) setFields(data.fields ?? []);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return fields;
}
