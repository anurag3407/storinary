import styles from './FormatChart.module.css';

const FORMAT_COLORS: Record<string, string> = {
  webp: 'var(--nb-blue)',
  jpeg: 'var(--nb-yellow)',
  png: 'var(--nb-green)',
  avif: 'var(--nb-purple)',
  gif: 'var(--nb-orange)',
  svg: 'var(--nb-mint)',
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
                  backgroundColor: FORMAT_COLORS[format] || 'var(--nb-black)',
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
