'use client';

import { useEffect, useState } from 'react';
import styles from './DeliveryAnalytics.module.css';
import type { DeliveryAnalytics as DeliveryAnalyticsData } from '@/lib/delivery-analytics';

const RANGES = [7, 30, 90] as const;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function DeliveryAnalyticsPanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<DeliveryAnalyticsData | null>(null);
  const [error, setError] = useState('');
  const maxDayBytes = Math.max(1, ...(data?.byDay.map((row) => row.bytes) || [1]));

  useEffect(() => {
    let active = true;
    fetch(`/api/analytics/delivery?days=${days}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed');
        return (await response.json()) as DeliveryAnalyticsData;
      })
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load analytics');
          setData(null);
        }
      });
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <section className={styles.panel} aria-label="Delivery analytics">
      <div className={styles.header}>
        <h2>Delivery Analytics</h2>
        <div className={styles.range}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={days === range ? styles.active : ''}
              onClick={() => setDays(range)}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {!data && !error && <p className={styles.loading}>Loading…</p>}
      {data && (
        <>
          <dl className={styles.totals}>
            <div><dt>Requests</dt><dd>{data.totals.events.toLocaleString()}</dd></div>
            <div><dt>Delivered</dt><dd>{formatBytes(data.totals.bytes)}</dd></div>
            <div><dt>Images</dt><dd>{data.images.events.toLocaleString()}</dd></div>
            <div><dt>Videos</dt><dd>{data.videos.events.toLocaleString()}</dd></div>
          </dl>

          <div className={styles.chart} aria-hidden="true">
            {data.byDay.map((point) => (
              <div key={point.day} className={styles.column} title={`${point.day}: ${formatBytes(point.bytes)}`}>
                <span style={{ height: `${Math.round((point.bytes / maxDayBytes) * 100)}%` }} />
              </div>
            ))}
          </div>

          <div className={styles.lists}>
            <div>
              <h3>Top Images</h3>
              {data.topImages.length ? data.topImages.slice(0, 5).map((item) => (
                <p key={item.id}>{item.originalName} · {item.events}</p>
              )) : <p className={styles.empty}>No image requests yet</p>}
            </div>
            <div>
              <h3>Top Videos</h3>
              {data.topVideos.length ? data.topVideos.slice(0, 5).map((item) => (
                <p key={item.id}>{item.originalName} · {item.events}</p>
              )) : <p className={styles.empty}>No video requests yet</p>}
            </div>
            <div>
              <h3>Referrers</h3>
              {data.referrers.length ? data.referrers.slice(0, 5).map((item) => (
                <p key={item.origin}>{item.origin || 'direct'} · {item.events}</p>
              )) : <p className={styles.empty}>No referrer data yet</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
