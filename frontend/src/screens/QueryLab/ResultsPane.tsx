// The right side of the query lab (spec 004): validate result, errors, plain-word summary,
// hit list, score panel, and the "why didn't this match" box.
import { clusterErrorReason, ClusterError } from '../../opensearch/errors';
import type { QueryLabResult, ValidateResult, Request } from '../../opensearch/querylab';
import type { Field } from '../../analysis/types';
import QuerySummary from './QuerySummary';
import HitList from './HitList';
import WhyNotMatched from './WhyNotMatched';

export type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ClusterError }
  | { status: 'ok'; result: QueryLabResult; explainWasOn: boolean };

function queryFieldNames(query: unknown): string[] {
  const names = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (['match', 'match_phrase', 'term', 'terms'].includes(key) && typeof value === 'object' && value !== null) {
        Object.keys(value as Record<string, unknown>).forEach((field) => names.add(field));
      } else {
        visit(value);
      }
    }
  };
  visit(query);
  return Array.from(names);
}

interface Props {
  request: Request;
  indexName: string | null;
  query: unknown;
  fields: Field[];
  run: RunState;
  validate: ValidateResult | null;
  selectedHitId: string | null;
  onSelectHit: (id: string | null) => void;
}

export default function ResultsPane({ request, indexName, query, fields, run, validate, selectedHitId, onSelectHit }: Props) {
  return (
    <div className="results-pane">
      {validate && (
        <div className={validate.valid ? 'validate-result ok' : 'validate-result bad'}>
          <p>{validate.valid ? 'This query is valid.' : 'This query is not valid.'}</p>
          {validate.explanations.map((exp, i) => (
            <p key={i} className="validate-explanation">
              {exp.explanation ?? exp.error}
            </p>
          ))}
        </div>
      )}

      <QuerySummary query={query} fields={fields} />

      {run.status === 'error' && (
        <p className="results-error" role="alert">
          {clusterErrorReason(run.error) ?? run.error.message}
        </p>
      )}

      {run.status === 'ok' && (
        <HitList
          result={run.result}
          selectedId={selectedHitId}
          explainWasOn={run.explainWasOn}
          queryFields={queryFieldNames(query)}
          onSelect={onSelectHit}
        />
      )}

      {indexName && <WhyNotMatched request={request} indexName={indexName} query={query} />}
    </div>
  );
}
