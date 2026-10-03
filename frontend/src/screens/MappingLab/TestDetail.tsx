// One test, step by step, saved side and typed side next to each other (spec 007, R3.10, R7.3).
import { notesFor } from '../../analysis/engine';
import type { AnalyzeResponse, Chain } from '../../analysis/types';
import { stagesOf, type Stage, type StageChip } from './stages';

const NOTE: Record<StageChip['status'], (c: StageChip) => string> = {
  '': () => '',
  changed: (c) => `was ${c.from}`,
  added: (c) => (c.synonym ? 'synonym' : 'new'),
  removed: () => 'removed',
  kept: () => 'protected',
};

function StageRow({ stage }: { stage: Stage }) {
  return (
    <div className="srow">
      <div className="st">
        {stage.name}
        {stage.sentence && <em>{stage.sentence}</em>}
      </div>
      {stage.kind === 'text' ? (
        <div className={`tx${stage.changed ? ' chg' : ''}`}>{stage.text || '(empty)'}</div>
      ) : (
        <div className="chips">
          {stage.chips.length === 0 && <span className="none">no tokens</span>}
          {stage.chips.map((c, i) => (
            <span key={i} className={`chip ${c.status}`}>
              {c.token}
              {c.status && <small>{NOTE[c.status](c)}</small>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface LaneProps {
  title: string;
  chain: Chain;
  text: string;
  response: AnalyzeResponse;
}

function Lane({ title, chain, text, response }: LaneProps) {
  return (
    <div className="lane">
      <h4>
        {title}
        <small>{chain.name}</small>
      </h4>
      {stagesOf(text, response, chain).map((s, i) => (
        <StageRow key={i} stage={s} />
      ))}
    </div>
  );
}

interface Props {
  saved: { text: string; chain: Chain; response: AnalyzeResponse };
  typed: { text: string; chain: Chain; response: AnalyzeResponse };
}

export default function TestDetail({ saved, typed }: Props) {
  const notes = [...new Set([...notesFor(saved.chain), ...notesFor(typed.chain)])];
  return (
    <div className="detail">
      <div className="lanes">
        <Lane title="Saved in the index" chain={saved.chain} text={saved.text} response={saved.response} />
        <Lane title="Typed by the shopper" chain={typed.chain} text={typed.text} response={typed.response} />
      </div>
      {notes.length > 0 && <p className="notes">{notes.join(' ')}</p>}
      <details className="raw">
        <summary>Show the raw analysis answer (saved text)</summary>
        <pre className="code">{JSON.stringify(saved.response, null, 2)}</pre>
      </details>
    </div>
  );
}
