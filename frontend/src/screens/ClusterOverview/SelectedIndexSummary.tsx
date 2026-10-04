import { HEALTH_COLOR, formatBytes } from './IndexChart';
import type { IndexSummary } from '../../opensearch/overview';

interface Props {
  index: IndexSummary;
  onBack: () => void;
}

// Shown instead of the top-10 chart once the user has picked one index (by search or by
// choosing a bar), so the screen reads as "here is that index" rather than still showing
// everything else underneath it.
export default function SelectedIndexSummary({ index, onBack }: Props) {
  return (
    <div className="selected-index">
      <button type="button" className="btn ghost small" onClick={onBack}>
        ← Back to all indexes
      </button>
      <div className="selected-index-card">
        <span className="selected-index-name">{index.name}</span>
        <span className="selected-index-stat">{formatBytes(index.sizeBytes)}</span>
        <span className="selected-index-stat">{index.docsCount.toLocaleString()} docs</span>
        <span className="bar-health">
          <i style={{ background: HEALTH_COLOR[index.health] ?? 'var(--muted)' }} />
          {index.health}
        </span>
      </div>
    </div>
  );
}
