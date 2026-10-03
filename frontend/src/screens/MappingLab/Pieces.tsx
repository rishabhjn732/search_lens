// Small pictures used by several parts of the Mapping lab: the steps of a field, and tokens.
import { Fragment } from 'react';
import { describeStep, type StepKind } from '../../analysis/engine';
import type { Chain, Step, Token } from '../../analysis/types';
import type { TokensState } from './useLabResults';

// The steps as coloured labels, in three colours (R2.2): changes the text first (c),
// cuts into tokens (t), changes the tokens (f). A step this page does not copy is dashed.
export function Steps({ chain }: { chain: Chain }) {
  const parts: { step: Step; kind: StepKind; cls: 'c' | 't' | 'f' }[] = [
    ...chain.charFilters.map((step) => ({ step, kind: 'char' as const, cls: 'c' as const })),
    { step: chain.tokenizer, kind: 'tokenizer' as const, cls: 't' as const },
    ...chain.filters.map((step) => ({ step, kind: 'filter' as const, cls: 'f' as const })),
  ];
  return (
    <div className="pipe">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="arr" aria-hidden="true">
              →
            </span>
          )}
          <span className={`pill ${p.step.known ? p.cls : 'x'}`} title={describeStep(p.kind, p.step.def.type)}>
            {p.step.name}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

interface ChipsProps {
  tokens: Token[];
  // mark each token green when it is in this set (R3.8)
  against?: Set<string>;
  // and red when it is not (only for the typed side)
  showMissing?: boolean;
}

export function Chips({ tokens, against, showMissing }: ChipsProps) {
  if (!tokens.length) return <span className="none">no tokens left</span>;
  const seen = new Set<string>();
  return (
    <div className="chips">
      {tokens.map((t) => {
        const key = `${t.token}@${t.position}`;
        if (seen.has(key)) return null;
        seen.add(key);
        let cls = '';
        let title: string | undefined;
        if (against) {
          if (against.has(t.token)) cls = ' found';
          else if (showMissing) cls = ' missing';
        } else if (t.type === 'SYNONYM') {
          cls = ' added';
          title = 'added by a synonym';
        } else if (t.keyword) {
          cls = ' kept';
          title = 'protected word';
        }
        return (
          <span key={key} className={`chip${cls}`} title={title}>
            {t.token}
          </span>
        );
      })}
    </div>
  );
}

export function TokenChips({ state }: { state: TokensState }) {
  if (state.status === 'pending') return <span className="none">…</span>;
  if (state.status === 'error') return <span className="err-text">{state.message}</span>;
  return <Chips tokens={state.tokens} />;
}
