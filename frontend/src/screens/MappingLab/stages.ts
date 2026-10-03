// A test, step by step (spec 007, R3.10): the original text, then each step with its tokens marked
// as changed, new, synonym, protected or removed. Ported from prototypes/lab/mapping-lab.html.
import { describeStep } from '../../analysis/engine';
import type { AnalyzeResponse, Chain, Token } from '../../analysis/types';

export type ChipStatus = '' | 'changed' | 'added' | 'removed' | 'kept';

export interface StageChip {
  token: string;
  status: ChipStatus;
  // the token this one replaced, for "was <old>"
  from?: string;
  synonym?: boolean;
}

export type Stage =
  | { kind: 'text'; name: string; text: string; changed: boolean; sentence?: string }
  | { kind: 'tokens'; name: string; chips: StageChip[]; sentence: string };

function diff(prev: Token[] | null, cur: Token[]): StageChip[] {
  if (!prev) return cur.map((t) => ({ token: t.token, status: '' }));
  const before = new Set(prev.map((t) => t.token));
  const after = new Set(cur.map((t) => t.token));
  const out: StageChip[] = cur.map((t) => {
    if (before.has(t.token)) return { token: t.token, status: t.keyword ? 'kept' : '' };
    const was = prev.find((x) => x.position === t.position && !after.has(x.token));
    const synonym = t.type === 'SYNONYM';
    if (synonym || !was) return { token: t.token, status: 'added', synonym };
    return { token: t.token, status: 'changed', from: was.token };
  });
  prev.forEach((t) => {
    if (after.has(t.token)) return;
    // gone, unless a token that is not new now stands at its position (then it was changed)
    const replaced = cur.some((x) => x.position === t.position && before.has(x.token));
    if (!replaced && !out.some((c) => c.status === 'changed' && c.from === t.token)) out.push({ token: t.token, status: 'removed' });
  });
  return out;
}

// Names and sentences come from the chain (the definition), matched to the answer by order.
export function stagesOf(original: string, response: AnalyzeResponse, chain: Chain): Stage[] {
  const d = response.detail;
  const stages: Stage[] = [{ kind: 'text', name: 'original text', text: original, changed: false }];
  let text = original;
  d.charfilters.forEach((cf, i) => {
    const step = chain.charFilters[i];
    const now = cf.filtered_text.join(' ');
    stages.push({ kind: 'text', name: step?.name ?? cf.name, text: now, changed: now !== text, sentence: describeStep('char', step?.def.type ?? cf.name) });
    text = now;
  });
  stages.push({ kind: 'tokens', name: chain.tokenizer.name, chips: diff(null, d.tokenizer.tokens), sentence: describeStep('tokenizer', chain.tokenizer.def.type) });
  let prev = d.tokenizer.tokens;
  d.tokenfilters.forEach((tf, i) => {
    const step = chain.filters[i];
    stages.push({ kind: 'tokens', name: step?.name ?? tf.name, chips: diff(prev, tf.tokens), sentence: describeStep('filter', step?.def.type ?? tf.name) });
    prev = tf.tokens;
  });
  return stages;
}
