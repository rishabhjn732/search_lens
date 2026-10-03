import type { ReactNode } from 'react';
import type { AnalyzeStep, AnalyzeToken } from './demoData';
import { demoAnalyze, demoHit, demoQuery } from './demoData';

// Short labels for the analyzer parts used in the example.
const LABELS: Record<string, string> = { standard: 'split', lowercase: 'lowercase', stemmer: 'stem' };
// Colour of a token that a filter changed: first filter yellow, later filters green.
const CHANGED = ['y', 'g'];

// Text the tokenizer dropped, found from the gaps between token offsets (for example "!").
function droppedText(text: string, tokens: AnalyzeToken[]): string[] {
  const dropped: string[] = [];
  let at = 0;
  for (const t of [...tokens].sort((a, b) => a.start_offset - b.start_offset)) {
    const gap = text.slice(at, t.start_offset).trim();
    if (gap) dropped.push(gap);
    at = t.end_offset;
  }
  const tail = text.slice(at).trim();
  if (tail) dropped.push(tail);
  return dropped;
}

function changedClass(before: AnalyzeStep, filterIndex: number, t: AnalyzeToken) {
  const old = before.tokens.find((b) => b.position === t.position);
  return old && old.token !== t.token ? CHANGED[Math.min(filterIndex, CHANGED.length - 1)] : '';
}

// Marks the parts of the title that match a final token, ignoring case.
function highlight(title: string, terms: string[]): ReactNode[] {
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return title.split(pattern).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

export default function QueryDemo() {
  const { tokenizer, tokenfilters } = demoAnalyze.detail;
  const finalTokens = tokenfilters[tokenfilters.length - 1].tokens.map((t) => t.token);
  const width = `${Math.min(demoHit._score / 10, 1) * 100}%`;
  let row = 1;

  return (
    <figure
      className="demo"
      aria-label={`Example: the query ${demoQuery} becomes the tokens ${finalTokens.join(' and ')} and matches a product with score ${demoHit._score}`}
    >
      <div className="bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={`step s${row++}`}>
        <span className="lbl">query</span>
        <span className="query">{demoQuery}</span>
      </div>
      <div className={`step s${row++}`}>
        <span className="lbl">{LABELS[tokenizer.name] ?? tokenizer.name}</span>
        <div className="chips">
          {tokenizer.tokens.map((t) => (
            <span className="chip" key={t.position}>
              {t.token}
            </span>
          ))}
          {droppedText(demoQuery, tokenizer.tokens).map((d) => (
            <span className="chip r" key={d} title="removed">
              {d}
            </span>
          ))}
        </div>
      </div>
      {tokenfilters.map((step, i) => (
        <div className={`step s${row++}`} key={step.name}>
          <span className="lbl">{LABELS[step.name] ?? step.name}</span>
          <div className="chips">
            {step.tokens.map((t) => (
              <span
                className={`chip ${changedClass(i === 0 ? tokenizer : tokenfilters[i - 1], i, t)}`.trim()}
                key={t.position}
              >
                {t.token}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className={`step s${row++}`}>
        <span className="lbl">top hit</span>
        <div className="hit">
          <span className="title">{highlight(demoHit._source.title, finalTokens)}</span>
          <span className="score">
            <span style={{ ['--w' as string]: width }} />
          </span>
          <code>{demoHit._score.toFixed(2)}</code>
        </div>
      </div>
    </figure>
  );
}
