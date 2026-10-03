// "The field … finds n of m searches", the split bar, and what would help most (spec 007, R3.6, R3.7, R4.1).
import type { MatchMode } from '../../analysis/compare';
import type { Fix } from '../../analysis/compare';
import type { Case } from './cases';
import type { FieldView, LabResults } from './useLabResults';

const FIX_SAY: Record<Fix, string> = {
  stemmer: 'Add a stemmer, so word forms like "shoe" and "shoes" become the same.',
  lowercase: 'Add the lowercase filter, so big and small letters do not matter.',
  asciifolding: 'Add asciifolding, so "café" and "cafe" are the same.',
  word_delimiter_graph: 'Use word_delimiter_graph with catenate_all, so "wi-fi" also becomes "wifi".',
  edge_ngram: 'Add an extra field that saves first letters (edge_ngram), for half-typed words.',
  ngram: 'Save small pieces of words (ngram), to find words from the middle. This makes the index much bigger.',
  fuzziness: 'Allow typos in the query with "fuzziness": "AUTO". This is a query setting, not a mapping change.',
  synonym: 'Add synonyms for words that mean the same thing.',
  stop: 'Remove the stop filter at search time, or keep stop words for this field.',
};

const fmt = (n: number) => n.toLocaleString('en-US');

interface Props {
  results: LabResults;
  view: FieldView;
  lessonName: string | null;
  cases: Case[];
  mode: MatchMode;
}

export default function TestSummary({ results, view, lessonName, cases, mode }: Props) {
  const path = view.field.path;
  const tally = { found: 0, partly: 0, not_found: 0 };
  const fixes = new Map<Fix, number>();
  cases.forEach((c) => {
    const o = results.test(path, c.saved, c.typed, mode);
    if (o.status === 'pending') return;
    if (o.status === 'error') return void tally.not_found++;
    const r = o.comparison.result;
    if (r === 'found') tally.found++;
    else if (r === 'partly') tally.partly++;
    else tally.not_found++;
    if (r !== 'found' && o.reason) fixes.set(o.reason.fix, (fixes.get(o.reason.fix) ?? 0) + 1);
  });
  const done = tally.found + tally.partly + tally.not_found;
  const best = [...fixes].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const { progress } = results;

  return (
    <div className="summary">
      <div>
        {progress.done < progress.total && (
          <p className="progress">
            <progress value={progress.done} max={progress.total} aria-label="Running the tests" /> Running the tests: {fmt(progress.done)} of {fmt(progress.total)}
          </p>
        )}
        <p className="big">
          The field <b>{path}</b> finds <b>{tally.found}</b> of {cases.length} searches{lessonName ? ` in "${lessonName}"` : ''}.
        </p>
        <div
          className="stack"
          role="img"
          aria-label={`${tally.found} found, ${tally.partly} partly found, ${tally.not_found} not found`}
        >
          {([['found', 'var(--green)'], ['partly', 'var(--yellow)'], ['not_found', 'var(--red)']] as const).map(([k, colour]) =>
            tally[k] && done ? <span key={k} style={{ width: `${(100 * tally[k]) / done}%`, background: colour }} /> : null,
          )}
        </div>
        <div className="legend">
          <span><i className="g" />found</span>
          <span><i className="y" />partly found (some words)</span>
          <span><i className="r" />not found</span>
        </div>
      </div>
      <div className="helps">
        <h3>What would help most</h3>
        {best.length ? (
          <ol>
            {best.map(([fix, n]) => (
              <li key={fix}>
                {FIX_SAY[fix]} <span className="n">{n} test{n === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="sub">{done === cases.length && done > 0 ? 'Nothing to fix here. Every search is found.' : 'Checking the tests…'}</p>
        )}
      </div>
    </div>
  );
}
