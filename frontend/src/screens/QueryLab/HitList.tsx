// The list of matching documents, each with a stacked score bar (spec 004, R3.1-R3.3). Clicking
// a hit expands its score explanation directly inside that card (R4.1), instead of somewhere
// else on the page where the click has no visible effect.
import { scoreRows } from '../../analysis/explain';
import type { QueryLabResult } from '../../opensearch/querylab';
import ScoreExplainPanel from './ScoreExplainPanel';

const BAR_COLOURS = ['#4c6ef5', '#2f9e44', '#e8590c', '#ae3ec9', '#1098ad', '#f08c00'];

interface Props {
  result: QueryLabResult;
  selectedId: string | null;
  explainWasOn: boolean;
  queryFields: string[];
  onSelect: (id: string | null) => void;
}

export default function HitList({ result, selectedId, explainWasOn, queryFields, onSelect }: Props) {
  if (result.hits.length === 0) {
    return <p className="hitlist-empty">No documents matched this query.</p>;
  }

  return (
    <div className="hit-list">
      <p className="hitlist-total">
        {result.total} document{result.total === 1 ? '' : 's'} matched. Showing the top {result.hits.length}.
      </p>
      <ul>
        {result.hits.map((hit) => {
          const rows = hit.explanation ? scoreRows(hit.explanation) : [];
          const topValue = rows.reduce((sum, row) => sum + Math.max(row.value, 0), 0) || 1;
          const open = hit.id === selectedId;
          return (
            <li key={hit.id} className={open ? 'hit-card open' : 'hit-card'}>
              <button
                type="button"
                className="hit"
                aria-expanded={open}
                onClick={() => onSelect(open ? null : hit.id)}
              >
                <span className="hit-head">
                  <span className="hit-id">{hit.id}</span>
                  <span className="hit-score">{hit.score.toFixed(2)}</span>
                </span>
                <span className="hit-bar" role="img" aria-label={`Score breakdown for document ${hit.id}`}>
                  {rows.map((row, i) => (
                    <span
                      key={row.id}
                      className="hit-bar-segment"
                      title={row.label}
                      style={{
                        width: `${(Math.max(row.value, 0) / topValue) * 100}%`,
                        background: BAR_COLOURS[i % BAR_COLOURS.length],
                      }}
                    />
                  ))}
                </span>
              </button>

              {open && !explainWasOn && (
                <p className="explain-off-note">Turn Explain on and run again to see how this score was built.</p>
              )}
              {open && explainWasOn && hit.explanation && (
                <ScoreExplainPanel docId={hit.id} explanation={hit.explanation} queryFields={queryFields} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
