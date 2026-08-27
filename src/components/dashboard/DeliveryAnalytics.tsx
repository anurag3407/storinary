'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './DeliveryAnalytics.module.css';
import type { DeliveryAnalytics as DeliveryAnalyticsData } from '@/lib/delivery-analytics';

const RANGES = [7, 30, 90] as const;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / 1024 ** exponent;
  return `${val < 10 && exponent > 0 ? val.toFixed(2) : val.toFixed(1)} ${units[exponent]}`;
}

export function DeliveryAnalyticsPanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<DeliveryAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback((numDays: number) => {
    setLoading(true);
    setError('');
    fetch(`/api/analytics/delivery?days=${numDays}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('API returned status ' + response.status);
        return (await response.json()) as DeliveryAnalyticsData;
      })
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => {
        console.error('Delivery analytics fetch error:', err);
        setError('Could not load delivery analytics');
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  const maxDayBytes = Math.max(1, ...(data?.byDay.map((row) => row.bytes) || [1]));

  return (
    <section className={styles.panel} aria-label="Delivery analytics">
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h2>Delivery & Bandwidth Analytics</h2>
          <span className={styles.headerSubtitle}>Real-time edge cache requests and asset bandwidth</span>
        </div>
        <div className={styles.range}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={days === range ? styles.activeRange : styles.rangeBtn}
              onClick={() => setDays(range)}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <p>⚠️ {error}</p>
          <button type="button" onClick={() => fetchAnalytics(days)} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {loading && !data && !error && (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <span>Aggregating delivery events...</span>
        </div>
      )}

      {data && (
        <>
          <dl className={styles.totals}>
            <div className={styles.totalCard}>
              <dt>Total CDN Requests</dt>
              <dd>{data.totals.events.toLocaleString()}</dd>
            </div>
            <div className={styles.totalCard}>
              <dt>Total Bandwidth</dt>
              <dd>{formatBytes(data.totals.bytes)}</dd>
            </div>
            <div className={styles.totalCard}>
              <dt>Image Deliveries</dt>
              <dd>{data.images.events.toLocaleString()}</dd>
            </div>
            <div className={styles.totalCard}>
              <dt>Video Streams</dt>
              <dd>{data.videos.events.toLocaleString()}</dd>
            </div>
          </dl>

          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <span>DAILY BANDWIDTH ({days} DAYS)</span>
              <span>PEAK: {formatBytes(maxDayBytes)}</span>
            </div>
            <div className={styles.chart} aria-label="Daily traffic chart">
              {data.byDay.map((point) => {
                const heightPct = Math.round((point.bytes / maxDayBytes) * 100);
                return (
                  <div
                    key={point.day}
                    className={styles.column}
                    title={`${point.day}\nRequests: ${point.events}\nBandwidth: ${formatBytes(point.bytes)}`}
                  >
                    <span
                      className={styles.bar}
                      style={{
                        height: `${Math.max(point.events > 0 ? 8 : 2, heightPct)}%`,
                        backgroundColor: point.events > 0 ? 'var(--nb-blue)' : '#e0ddd5',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.lists}>
            <div className={styles.listCard}>
              <h3>🔥 Top Images</h3>
              {data.topImages.length ? (
                data.topImages.slice(0, 5).map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <span className={styles.itemName} title={item.originalName}>{item.originalName}</span>
                    <span className={styles.itemBadge}>{item.events} hits</span>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>No image requests recorded yet</p>
              )}
            </div>

            <div className={styles.listCard}>
              <h3>🎬 Top Videos</h3>
              {data.topVideos.length ? (
                data.topVideos.slice(0, 5).map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <span className={styles.itemName} title={item.originalName}>{item.originalName}</span>
                    <span className={styles.itemBadge}>{item.events} plays</span>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>No video streams recorded yet</p>
              )}
            </div>

            <div className={styles.listCard}>
              <h3>🌐 Top Referrers</h3>
              {data.referrers.length ? (
                data.referrers.slice(0, 5).map((item) => (
                  <div key={item.origin} className={styles.listItem}>
                    <span className={styles.itemName} title={item.origin}>{item.origin || 'Direct Traffic'}</span>
                    <span className={styles.itemBadge}>{item.events}</span>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>No external referrers logged</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
