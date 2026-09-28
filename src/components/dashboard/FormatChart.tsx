import styles from './FormatChart.module.css';

const FORMAT_COLORS: Record<string, string> = {
  webp: 'var(--ui-chart-1)',
  jpeg: 'var(--ui-chart-2)',
  png: 'var(--ui-chart-3)',
  avif: 'var(--ui-chart-4)',
  gif: 'var(--ui-chart-5)',
  svg: 'var(--ui-chart-6)',
};

interface FormatChartProps {
  data: Record<string, number>;
  total: number;
}

export function FormatChart({ data, total }: FormatChartProps) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Format Distribution</h2>
      {entries.map(([format, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={format} className={styles.row}>
            <span className={styles.label}>{format.toUpperCase()}</span>
            <div className={styles.barContainer}>
              <div
                className={styles.bar}
                style={{
                  width: `${pct}%`,
                  backgroundColor: FORMAT_COLORS[format] || 'var(--ui-border-strong)',
                }}
              />
            </div>
            <span className={styles.percent}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
