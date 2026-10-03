// The tests as rows: result, lesson, saved text and tokens, typed text and tokens, one reason (spec 007, R3.8, R3.9).
import type { MatchMode, MatchResult } from '../../analysis/compare';
import { Chips } from './Pieces';
import type { Case } from './cases';
import TestDetail from './TestDetail';
import type { FieldView, LabResults, TestOutcome } from './useLabResults';

export type Verdict = 'all' | 'found' | 'partly' | 'not_found';

const WORD: Record<MatchResult, string> = {
  found: 'Found',
  partly: 'Partly found',
  not_found: 'Not found',
  nothing_left: 'Nothing to search',
};

const verdictOf = (o: TestOutcome): Exclude<Verdict, 'all'> | null =>
  o.status === 'pending' ? null : o.status === 'error' ? 'not_found' : o.comparison.result === 'found' ? 'found' : o.comparison.result === 'partly' ? 'partly' : 'not_found';

interface Props {
  results: LabResults;
  view: FieldView;
  cases: Case[];
  lessonNames: Record<string, string>;
  mode: MatchMode;
  verdict: Verdict;
  shown: number;
  open: Set<string>;
  onToggle: (id: string) => void;
  onMore: () => void;
  onRemoveOwn: (index: number) => void;
}

export default function TestList({ results, view, cases, lessonNames, mode, verdict, shown, open, onToggle, onMore, onRemoveOwn }: Props) {
  const path = view.field.path;
  const rows = cases
    .map((c) => ({ c, o: results.test(path, c.saved, c.typed, mode) }))
    .filter(({ o }) => verdict === 'all' || verdictOf(o) === verdict);
  if (!rows.length) return <p className="sub">No tests here. Try another filter.</p>;

  return (
    <>
      <ul className="cases" aria-label="Tests">
        {rows.slice(0, shown).map(({ c, o }) => {
          const isOpen = open.has(c.id);
          const savedSet = new Set(o.status === 'done' ? o.saved.map((t) => t.token) : []);
          const typedSet = new Set(o.status === 'done' ? o.typed.map((t) => t.token) : []);
          const savedResp = results.tokens(path, 'index', c.saved);
          const typedResp = results.tokens(path, 'search', c.typed);
          return (
            <li key={c.id} className={`case${isOpen ? ' open' : ''}`}>
              <button type="button" className="row" aria-expanded={isOpen} onClick={() => onToggle(c.id)}>
                <span>
                  {o.status === 'done' ? (
                    <span className={`verdict ${o.comparison.result}`}>{WORD[o.comparison.result]}</span>
                  ) : o.status === 'error' ? (
                    <span className="verdict not_found">Could not run</span>
                  ) : (
                    <span className="verdict pending">Checking…</span>
                  )}
                  <span className="les">{lessonNames[c.lesson]}</span>
                </span>
                <span>
                  <span className="txt">
                    <small>saved</small>
                    {c.saved}
                  </span>
                  {o.status === 'done' && <Chips tokens={o.saved} against={typedSet} />}
                </span>
                <span>
                  <span className="txt">
                    <small>typed</small>
                    {c.typed}
                  </span>
                  {o.status === 'done' && <Chips tokens={o.typed} against={savedSet} showMissing />}
                </span>
                <span className="caret" aria-hidden="true">›</span>
              </button>
              {o.status === 'done' && o.reason && o.comparison.result !== 'found' && (
                <p className="why">
                  <b>{o.reason.fix}</b>
                  {o.reason.text}
                </p>
              )}
              {o.status === 'error' && <p className="why err-text">{o.message}</p>}
              {c.own !== undefined && (
                <button type="button" className="small remove" onClick={() => onRemoveOwn(c.own!)}>
                  Remove this test
                </button>
              )}
              {isOpen && savedResp.status === 'done' && typedResp.status === 'done' && view.index && view.search && (
                <TestDetail
                  saved={{ text: c.saved, chain: view.index, response: savedResp.response }}
                  typed={{ text: c.typed, chain: view.search, response: typedResp.response }}
                />
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > shown && (
        <button type="button" className="more" onClick={onMore}>
          Show more ({rows.length - shown} left)
        </button>
      )}
    </>
  );
}
