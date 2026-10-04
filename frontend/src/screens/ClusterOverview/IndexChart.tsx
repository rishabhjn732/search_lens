import { useState } from 'react';
import type { IndexSummary } from '../../opensearch/overview';

type SortBy = 'size' | 'docs';

export const HEALTH_COLOR: Record<string, string> = {
  green: 'var(--green)',
  yellow: 'var(--yellow)',
  red: 'var(--red)',
};

// Human-readable size, close enough for a chart label (R2.1).
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

interface Props {
  indexes: IndexSummary[];
  onOpenIndex: (name: string) => void;
}

export default function IndexChart({ indexes, onOpenIndex }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>('size');

  const nonSystem = indexes.filter((i) => !i.isSystem);
  const systemCount = indexes.length - nonSystem.length;
  const sorted = [...nonSystem].sort((a, b) =>
    sortBy === 'size' ? b.sizeBytes - a.sizeBytes : b.docsCount - a.docsCount,
  );
  const top10 = sorted.slice(0, 10);
  const extraCount = Math.max(0, nonSystem.length - 10);
  const maxValue = Math.max(1, ...top10.map((i) => (sortBy === 'size' ? i.sizeBytes : i.docsCount)));

  if (indexes.length === 0) {
    return <p className="overview-empty">This cluster has no indexes yet.</p>;
  }

  return (
    <div className="index-chart">
      <div className="chart-head">
        <label>
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="size">Size</option>
            <option value="docs">Documents</option>
          </select>
        </label>
      </div>
      <ul className="chart-bars">
        {top10.map((index) => {
          const value = sortBy === 'size' ? index.sizeBytes : index.docsCount;
          const widthPct = (value / maxValue) * 100;
          return (
            <li key={index.name}>
              <button type="button" className="chart-bar" onClick={() => onOpenIndex(index.name)}>
                <span className="bar-label">{index.name}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${widthPct}%` }} />
                </span>
                <span className="bar-value">
                  {sortBy === 'size' ? formatBytes(index.sizeBytes) : index.docsCount.toLocaleString()}
                </span>
                <span className="bar-health">
                  <i style={{ background: HEALTH_COLOR[index.health] ?? 'var(--muted)' }} />
                  {index.health}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="chart-counts">
        {systemCount} system {systemCount === 1 ? 'index' : 'indexes'} not shown.{' '}
        {extraCount > 0 && `${extraCount} more ${extraCount === 1 ? 'index' : 'indexes'} not shown here.`}
      </p>
    </div>
  );
}
