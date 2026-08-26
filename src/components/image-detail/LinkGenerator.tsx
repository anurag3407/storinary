'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/hooks/useToast';
import type { GeneratedLinks, TransformParams } from '@/types';
import styles from './LinkGenerator.module.css';

interface LinkGeneratorProps {
  links: GeneratedLinks;
  transformParams?: TransformParams;
}

interface LinkRow {
  key: string;
  label: string;
  text: string;
}

function buildTransformUrl(links: GeneratedLinks, params: TransformParams): string | null {
  if (links.transformUrl && new URLSearchParams(links.transformUrl.split('?')[1] || '').has('token')) {
    return links.transformUrl;
  }

  const q = new URLSearchParams();
  if (params.w) q.set('w', String(params.w));
  if (params.h) q.set('h', String(params.h));
  if (params.q) q.set('q', String(params.q));
  if (params.fmt) q.set('fmt', params.fmt);
  if (params.fit) q.set('fit', params.fit);
  if (params.g) q.set('g', params.g);
  if (params.ar) q.set('ar', params.ar);
  if (params.b) q.set('b', params.b);
  if (typeof params.a === 'number') q.set('a', String(params.a));
  for (const effect of params.e ?? []) {
    if (effect.grayscale) q.append('e', 'grayscale');
    else if (effect.sepia !== undefined) q.append('e', `sepia:${effect.sepia}`);
    else if (effect.blur !== undefined) q.append('e', `blur:${effect.blur}`);
    else if (effect.sharpen !== undefined) q.append('e', `sharpen:${effect.sharpen}`);
    else if (effect.saturation !== undefined) {
      q.append('e', `saturation:${Math.round(effect.saturation * 100)}`);
    }
  }
  if (params.dpr) q.set('dpr', String(params.dpr));

  const s = q.toString();
  return s ? `${links.transformBase}?${s}` : null;
}

export function LinkGenerator({ links, transformParams }: LinkGeneratorProps) {
  const { copy } = useClipboard();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const transformUrl =
    transformParams && Object.keys(transformParams).length > 0
      ? buildTransformUrl(links, transformParams)
      : null;

  const rows: LinkRow[] = [
    { key: 'direct', label: 'Direct URL', text: links.direct },
    { key: 'html', label: 'HTML', text: links.html },
    { key: 'markdown', label: 'Markdown', text: links.markdown },
    { key: 'css', label: 'CSS', text: links.css },
    ...(transformUrl
      ? [{ key: 'transform', label: 'Transform URL', text: transformUrl }]
      : []),
  ];

  const handleCopy = async (key: string, text: string) => {
    const ok = await copy(text);
    if (ok) {
      setCopiedKey(key);
      toast.success('Copied!');
      window.setTimeout(() => setCopiedKey(null), 2000);
    } else {
      toast.error('Copy failed');
    }
  };

  const copyAll = async () => {
    const block = rows.map((r) => `${r.label}: ${r.text}`).join('\n');
    const ok = await copy(block);
    if (ok) {
      toast.success('All links copied!');
    } else {
      toast.error('Copy failed');
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Links</h2>
      <div className={styles.rows}>
        {rows.map((row) => (
          <div key={row.key} className={styles.row}>
            <span className={styles.label}>{row.label}</span>
            <div className={styles.rowInner}>
              <code className={styles.code}>{row.text}</code>
              <Button
                variant="outline"
                size="sm"
                icon={copiedKey === row.key ? '✓' : '📋'}
                onClick={() => handleCopy(row.key, row.text)}
              >
                {copiedKey === row.key ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="primary" icon="📋" onClick={copyAll} fullWidth>
        Copy All Links
      </Button>
    </div>
  );
}
