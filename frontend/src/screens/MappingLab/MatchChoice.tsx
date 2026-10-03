// "Any word" or "All words" (spec 007, R3.5).
import type { MatchMode } from '../../analysis/compare';

const SAY: Record<MatchMode, string> = {
  any: 'Like a normal "match" query: one found word is enough to show the product.',
  all: 'Like "operator": "and": every typed word must be found.',
};

export default function MatchChoice({ mode, onChange }: { mode: MatchMode; onChange: (m: MatchMode) => void }) {
  return (
    <div className="ctrl">
      <span className="lbl" id="ml-mode-label">
        How many typed words must be found?
      </span>
      <div className="seg" role="group" aria-labelledby="ml-mode-label">
        <button type="button" aria-pressed={mode === 'any'} onClick={() => onChange('any')}>
          Any word
        </button>
        <button type="button" aria-pressed={mode === 'all'} onClick={() => onChange('all')}>
          All words
        </button>
      </div>
      <span className="say">{SAY[mode]}</span>
    </div>
  );
}
