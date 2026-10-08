'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertIcon } from '@/components/ui/icons';
import { DetailView } from '@/components/image-detail/DetailView';
import type { ImageDetailResponse } from '@/types';

export function ImageDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<ImageDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/images/${encodeURIComponent(id)}`);
        if (res.status === 404) {
          if (active) setError('not_found');
          return;
        }
        if (!res.ok) {
          if (active) setError('failed');
          return;
        }
        const json = (await res.json()) as ImageDetailResponse;
        if (active) setData(json);
      } catch {
        if (active) setError('failed');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ height: '3rem', width: '250px', background: 'var(--border, #2a2a2a)', borderRadius: '8px' }} />
        <div style={{ height: '400px', background: 'var(--card-bg, #1a1a1a)', borderRadius: '12px' }} />
      </div>
    );
  }

  if (error === 'not_found' || (!data && !loading)) {
    return (
      <>
        <Header title="Image Not Found" description="The requested image does not exist." />
        <EmptyState
          icon={<AlertIcon size={26} />}
          headingLevel={2}
          title="Image Not Found"
          description="This image may have been deleted or the link is incorrect."
          action={
            <Link href="/gallery">
              <Button variant="secondary">Back to Gallery</Button>
            </Link>
          }
        />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header title="Image unavailable" description="We couldn't load this image right now." />
        <EmptyState
          icon={<AlertIcon size={26} />}
          headingLevel={2}
          title="Could not load this image"
          description="The app couldn't reach its database. Your image has not been deleted — try again in a moment, or head back to the gallery."
          action={
            <Link href="/gallery">
              <Button variant="secondary">Back to Gallery</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <Header
        title={data.image.originalName}
        description={`${data.image.width} × ${data.image.height} px · ${data.image.format.toUpperCase()}`}
      />
      <DetailView image={data.image} links={data.links} versions={data.versions} />
    </>
  );
}
