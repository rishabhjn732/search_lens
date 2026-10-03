// One card per field (spec 007, R2.1 to R2.5, R2.7, R2.8).
import { plainChain } from '../../analysis/compare';
import { Steps, TokenChips } from './Pieces';
import { analysisKey } from './runner';
import type { FieldView, LabResults } from './useLabResults';

// One sentence about how fields that are not text or keyword are found (R2.4).
function otherSay(type: string): string {
  if (/date/.test(type)) return 'A date. Not split into words. Found by exact day or a date range, for example "last 7 days".';
  if (type === 'boolean') return 'Yes or no. Found by exact value only.';
  if (type === 'geo_point') return 'A place on the map. Found by distance.';
  if (type === 'nested') return 'A list of small objects. Each one is searched on its own.';
  if (/^(long|integer|short|byte|double|float|half_float|scaled_float|unsigned_long)$/.test(type)) {
    return 'A number. Not split into words. Found by exact value or a range, for example price from 10 to 50.';
  }
  return 'Not text. It is not split into words.';
}

interface CardProps {
  view: FieldView;
  results: LabResults;
  exampleText: string;
  selected: boolean;
  onTest: (path: string) => void;
}

function FieldCard({ view, results, exampleText, selected, onTest }: CardProps) {
  const { field, index, search, problem } = view;
  const differs = field.kind === 'text' && index && search && analysisKey(index, '') !== analysisKey(search, '');
  const score = results.found(field.path);

  let body;
  if (field.kind === 'other') {
    body = <p className="plain">{otherSay(field.type)}</p>;
  } else if (problem) {
    body = <div className="err">{problem}</div>;
  } else if (index && search) {
    body = (
      <>
        <p className="plain">
          {field.kind === 'keyword' && !field.normalizer
            ? 'Saved whole, exactly as written. "Nike" and "nike" are different.'
            : plainChain(index)}
        </p>
        <div className="side">
          <span>{field.kind === 'keyword' ? (field.normalizer ? 'normalizer' : 'steps') : 'saved with'}</span>
          <Steps chain={index} />
        </div>
        <div className="side">
          <span>saved tokens</span>
          <TokenChips state={results.tokens(field.path, 'index', exampleText)} />
        </div>
        {differs && (
          <>
            <div className="diff">
              Searching uses other steps: "{field.searchAnalyzer}". {plainChain(search)}
            </div>
            <div className="side">
              <span>searched with</span>
              <Steps chain={search} />
            </div>
            <div className="side">
              <span>typed tokens</span>
              <TokenChips state={results.tokens(field.path, 'search', exampleText)} />
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <article className={`fcard${selected ? ' sel' : ''}`} aria-label={`Field ${field.path}`} aria-current={selected || undefined}>
      <header>
        <span className="name">{field.path}</span>
        {field.parent && <span className="of">extra way to save {field.parent}</span>}
        <span className={`type ${field.kind}`}>{field.type}</span>
      </header>
      {body}
      {score && (
        <footer>
          <span className="score">
            {score.error
              ? 'The tests could not run for this field.'
              : score.ready
                ? `Finds ${score.found} of ${score.total} test searches`
                : 'Checking the test searches…'}
          </span>
          <button type="button" className="small" onClick={() => onTest(field.path)}>
            Test this field ↓
          </button>
        </footer>
      )}
    </article>
  );
}

interface Props {
  results: LabResults;
  exampleText: string;
  selected: string | null;
  onTest: (path: string) => void;
}

export default function FieldCards({ results, exampleText, selected, onTest }: Props) {
  return (
    <div className="cards">
      {results.fields.map((view) => (
        <FieldCard key={view.field.path} view={view} results={results} exampleText={exampleText} selected={view.field.path === selected} onTest={onTest} />
      ))}
    </div>
  );
}
