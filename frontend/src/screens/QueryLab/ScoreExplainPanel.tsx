// One hit's score explained (spec 004, R4.1-R4.5). A top-level row that is a plain BM25-style
// match (idf x tf, with an optional boost) gets a readable formula card with the real field,
// token and numbers, instead of a flat "clause 1" list. Anything deeper or less regular (a
// nested bool, a filter) falls back to a generic one-step-at-a-time tree (R4.3).
import { useState } from 'react';
import {
  fieldsNotCounted,
  filtersPassed,
  formulaOf,
  scoreRows,
  splitVariable,
  type ExplainRow,
  type RawExplanationNode,
} from '../../analysis/explain';

// Keyed by the id of the row whose children are being shown ('root' for the top level).
type OpenByParent = Record<string, string | null>;

interface RowProps {
  row: ExplainRow;
  parentKey: string;
  openByParent: OpenByParent;
  onToggle: (parentKey: string, rowId: string) => void;
}

function GenericRow({ row, parentKey, openByParent, onToggle }: RowProps) {
  const open = openByParent[parentKey] === row.id;
  return (
    <li className={row.kind === 'non-scoring' ? 'explain-row non-scoring' : 'explain-row'}>
      <button type="button" aria-expanded={open} onClick={() => onToggle(parentKey, row.id)}>
        <strong>{row.label}</strong> — {row.value.toFixed(2)}
      </button>
      {open && (
        <>
          <p className="explain-sentence">{row.sentence}</p>
          {row.children.length > 0 && (
            <ul>
              {row.children.map((child) => (
                <GenericRow key={child.id} row={child} parentKey={row.id} openByParent={openByParent} onToggle={onToggle} />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

function VariableRows({ node }: { node: ExplainRow }) {
  const formula = formulaOf(node.description);
  return (
    <div className="metric-card">
      {formula && <code className="metric-formula">{formula}</code>}
      <div className="metric-vars">
        {node.children.map((child) => {
          const { symbol, desc } = splitVariable(child.description);
          return (
            <div key={child.id} className="metric-var-row">
              <span className="metric-var-left">
                {symbol && <span className="metric-symbol">{symbol}</span>}
                <span className="metric-var-desc">{desc}</span>
              </span>
              <span className="metric-var-value">
                {Number.isInteger(child.value) ? child.value.toLocaleString() : child.value.toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({ row }: { row: ExplainRow }) {
  const idf = row.children.find((c) => c.metric === 'idf');
  const tf = row.children.find((c) => c.metric === 'tf');
  const boost = row.children.find((c) => c.metric === 'boost');
  const [field, token] = row.label.includes(':') ? row.label.split(/:(.+)/) : [null, row.label];

  const formulaParts = [idf && 'idf', tf && 'tf', boost && 'boost'].filter(Boolean) as string[];
  const valueParts = [idf?.value, tf?.value, boost?.value].filter((v): v is number => v !== undefined);

  return (
    <div className="match-card">
      <div className="match-card-head">
        <div>
          {field && <p className="match-field">{field}</p>}
          <p className="match-token">{token}</p>
        </div>
        <div className="match-score" title="This row's contribution to the document's score">
          {row.value.toFixed(4)}
        </div>
      </div>
      <p className="match-description">{row.description}</p>

      {formulaParts.length > 0 && (
        <div className="formula-strip">
          <span>
            score = {formulaParts.join(' × ')}
          </span>
          <span className="formula-strip-numbers">
            {row.value.toFixed(4)} = {valueParts.map((v) => v.toFixed(4)).join(' × ')}
          </span>
        </div>
      )}

      <div className="metric-grid">
        {idf && (
          <div>
            <h4 className="metric-title idf">Inverse document frequency (idf)</h4>
            <VariableRows node={idf} />
          </div>
        )}
        {tf && (
          <div>
            <h4 className="metric-title tf">Term frequency (tf)</h4>
            <VariableRows node={tf} />
          </div>
        )}
      </div>
      {boost && <p className="match-boost">Boost: {boost.value.toFixed(2)}</p>}

      {/* Anything that isn't a recognised idf/tf/boost triple (a nested bool, say) still
          needs a way in, so it gets the generic collapsible tree underneath (R4.3). */}
      {row.children.some((c) => !c.metric) && (
        <ul className="generic-fallback">
          {row.children
            .filter((c) => !c.metric)
            .map((child) => (
              <GenericRow key={child.id} row={child} parentKey={row.id} openByParent={{}} onToggle={() => {}} />
            ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  docId: string;
  explanation: RawExplanationNode;
  queryFields: string[];
}

export default function ScoreExplainPanel({ docId, explanation, queryFields }: Props) {
  const [openByParent, setOpenByParent] = useState<OpenByParent>({});
  // Filter clauses (ConstantScoreQuery) are listed once, below, by filtersPassed — they are
  // not "a field or word that contributed" (R4.1), so they are left out of the main rows here.
  const rows = scoreRows(explanation).filter((row) => !/^ConstantScoreQuery/i.test(row.description));
  const notCounted = fieldsNotCounted(queryFields, explanation);
  const filters = filtersPassed(explanation);

  function onToggle(parentKey: string, rowId: string) {
    setOpenByParent((prev) => ({
      ...prev,
      [parentKey]: prev[parentKey] === rowId ? null : rowId,
    }));
  }

  return (
    <section className="score-explain" aria-label={`Score for document ${docId}`}>
      {rows.map((row) =>
        row.children.some((c) => c.metric === 'idf' || c.metric === 'tf') ? (
          <MatchCard key={row.id} row={row} />
        ) : (
          <ul key={row.id} className="generic-fallback">
            <GenericRow row={row} parentKey="root" openByParent={openByParent} onToggle={onToggle} />
          </ul>
        ),
      )}

      {notCounted.length > 0 && (
        <ul className="not-counted">
          {notCounted.map((item) => (
            <li key={item.field}>
              <strong>{item.field}</strong> did not count — {item.reason}
            </li>
          ))}
        </ul>
      )}
      {filters.length > 0 && (
        <div className="filters-passed">
          <p>Filters this document passed:</p>
          <ul>
            {filters.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
