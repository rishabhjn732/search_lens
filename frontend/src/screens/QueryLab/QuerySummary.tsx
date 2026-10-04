// "Your query in plain words" box, with mapping-mistake warnings (spec 004, R6.1, R6.2).
import { plainWordsForQuery, queryWarnings } from '../../analysis/explain';
import type { Field } from '../../analysis/types';

interface Props {
  query: unknown;
  fields: Field[];
}

export default function QuerySummary({ query, fields }: Props) {
  const warnings = queryWarnings(query, fields);

  return (
    <div className="query-summary">
      <p className="query-summary-text">{plainWordsForQuery(query)}</p>
      {warnings.length > 0 && (
        <ul className="query-summary-warnings">
          {warnings.map((warning, i) => (
            <li key={`${warning.clause}-${warning.field}-${i}`} className="status bad">
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
