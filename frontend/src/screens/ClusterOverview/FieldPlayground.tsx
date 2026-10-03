import { useMemo, useState } from 'react';
import { analyzeInBrowser } from '../../analysis/engine';
import { Chips } from '../MappingLab/Pieces';
import type { Chain, Field, Step } from '../../analysis/types';

interface Props {
  field: Field;
  chain: Chain;
  onClose: () => void;
}

function moveStep<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// R9: a full view of one field's analyzer, with its token filters reorderable, running
// entirely in the browser (no cluster call) — see design.md "A field's analyzer playground".
export default function FieldPlayground({ field, chain, onClose }: Props) {
  const [text, setText] = useState('Running Shoes');
  const [filters, setFilters] = useState<Step[]>(chain.filters);
  const isReordered = filters !== chain.filters;

  const editedChain: Chain = useMemo(() => ({ ...chain, filters }), [chain, filters]);
  const result = useMemo(() => analyzeInBrowser(editedChain, text), [editedChain, text]);

  return (
    <div className="field-playground" role="dialog" aria-label={`Try ${field.path}'s analyzer`}>
      <div className="playground-head">
        <h3>Try it: {field.path}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="playground-note">
        These steps run in your browser. The field&apos;s real analyzer on the cluster is not changed.
      </p>

      <label className="playground-input">
        Text to try
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      {chain.charFilters.length > 0 && (
        <div className="playground-step">
          <h4>Character filters</h4>
          <div className="field-pills">
            {chain.charFilters.map((s) => (
              <span key={s.name} className="pill">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="playground-step">
        <h4>Tokenizer: {chain.tokenizer.name}</h4>
        <Chips tokens={result.detail.tokenizer.tokens} />
      </div>

      <div className="playground-step">
        <div className="playground-step-head">
          <h4>Token filters, in order</h4>
          <button
            type="button"
            className="btn ghost small"
            disabled={!isReordered}
            onClick={() => setFilters(chain.filters)}
          >
            Reset to the cluster's order
          </button>
        </div>
        {filters.length === 0 && <p className="plain">This analyzer has no token filters.</p>}
        <ul className="playground-filters">
          {filters.map((step, i) => (
            <li key={`${step.name}-${i}`} className="playground-filter">
              <div className="playground-filter-head">
                <span className="pill">{step.name}</span>
                <div className="move-buttons">
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={i === 0}
                    aria-label={`Move ${step.name} earlier`}
                    onClick={() => setFilters((f) => moveStep(f, i, i - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={i === filters.length - 1}
                    aria-label={`Move ${step.name} later`}
                    onClick={() => setFilters((f) => moveStep(f, i, i + 1))}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <Chips tokens={result.detail.tokenfilters[i]?.tokens ?? []} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
