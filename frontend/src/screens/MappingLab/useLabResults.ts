// Gives the Mapping lab screen its analysis results (spec 007, R2.7, R3.2, R4.1, R4.2).
// It makes one runner for each definition, asks it for every test on every field, and lets the
// screen look at what has arrived. Today the source is the browser copy; exact mode (task 9)
// only changes the source.
import { useEffect, useMemo, useState } from 'react';
import { NOTHING_LEFT, compareTokens, reasonFor, type Comparison, type MatchMode, type Reason } from '../../analysis/compare';
import { chainFor, listFields, type Definition } from '../../analysis/definition';
import { analyzeInBrowser, finalTokens } from '../../analysis/engine';
import type { AnalyzeResponse, Chain, Field, Token } from '../../analysis/types';
import { createRunner, type Progress, type Runner, type Source } from './runner';

export type Side = 'index' | 'search';

export type TokensState =
  | { status: 'pending' }
  | { status: 'done'; tokens: Token[]; response: AnalyzeResponse }
  | { status: 'error'; message: string };

// One test on one field (R3.5, R3.9): both sides compared, and one reason when it is not found.
export type TestOutcome =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; comparison: Comparison; saved: Token[]; typed: Token[]; reason?: Reason };

export interface FieldView {
  field: Field;
  // null for fields that are not tested (numbers, dates, objects) and for fields with a problem
  index: Chain | null;
  search: Chain | null;
  // R2.7: a field with a problem shows it instead of tokens and is left out of the tests
  problem: string | null;
}

export interface Found {
  found: number;
  total: number;
  ready: boolean;
  error?: string;
}

export interface LabResults {
  fields: FieldView[];
  tokens(path: string, side: Side, text: string): TokensState;
  test(path: string, saved: string, typed: string, mode: MatchMode): TestOutcome;
  found(path: string): Found | null;
  progress: Progress;
}

const browserSource: Source = async (chain, text) => analyzeInBrowser(chain, text);

function viewOf(field: Field, def: Definition): FieldView {
  if (field.kind !== 'text' && field.kind !== 'keyword') return { field, index: null, search: null, problem: null };
  const index = chainFor(field, 'index', def.analysis);
  const search = field.kind === 'keyword' ? index : chainFor(field, 'search', def.analysis);
  const bad = [index, search].find((c) => c && 'error' in c);
  if (bad && 'error' in bad) return { field, index: null, search: null, problem: bad.error };
  return { field, index: index as Chain, search: search as Chain, problem: null };
}

export function useLabResults(definition: Definition | null, exampleText: string, cases: [string, string][]): LabResults {
  const [runner, setRunner] = useState<Runner | null>(null);
  const [, setTick] = useState(0);

  const fields = useMemo(
    () => (definition ? listFields(definition.mappings, definition.analysis).filter((f) => f.kind !== 'object').map((f) => viewOf(f, definition)) : []),
    [definition],
  );

  // A new definition makes a new runner and stops the old run (R4.2). The runner is made in an
  // effect, not while drawing, because React may run effects twice in development.
  useEffect(() => {
    if (!definition) {
      setRunner(null);
      return;
    }
    const r = createRunner(browserSource, { parallel: 4 });
    const stop = r.subscribe(() => setTick((t) => t + 1));
    setRunner(r);
    return () => {
      stop();
      r.cancel();
    };
  }, [definition]);

  // Ask for the example text on every card, and every test on every field without a problem (R3.2).
  useEffect(() => {
    if (!runner) return;
    fields.forEach(({ index, search }) => {
      if (!index || !search) return;
      void runner.get(index, exampleText);
      if (search !== index) void runner.get(search, exampleText);
      cases.forEach(([saved, typed]) => {
        void runner.get(index, saved);
        void runner.get(search, typed);
      });
    });
    setTick((t) => t + 1); // show the progress from the start, not only after the first answer (R4.1)
  }, [runner, fields, exampleText, cases]);

  const byPath = useMemo(() => new Map(fields.map((f) => [f.field.path, f])), [fields]);

  function tokens(path: string, side: Side, text: string): TokensState {
    const view = byPath.get(path);
    const chain = view && (side === 'index' ? view.index : view.search);
    const outcome = chain && runner?.lookup(chain, text);
    if (!outcome || outcome.status === 'pending') return { status: 'pending' };
    if (outcome.status === 'error') return { status: 'error', message: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) };
    return { status: 'done', tokens: finalTokens(outcome.response), response: outcome.response };
  }

  function test(path: string, saved: string, typed: string, mode: MatchMode): TestOutcome {
    const d = tokens(path, 'index', saved);
    const t = tokens(path, 'search', typed);
    const failed = [d, t].find((x) => x.status === 'error');
    if (failed && failed.status === 'error') return { status: 'error', message: failed.message };
    if (d.status !== 'done' || t.status !== 'done') return { status: 'pending' };
    const comparison = compareTokens(d.tokens, t.tokens, mode);
    let reason: Reason | undefined;
    if (comparison.result === 'nothing_left') reason = NOTHING_LEFT;
    else if (comparison.result !== 'found') reason = reasonFor(comparison.unfound[0][0], d.tokens);
    return { status: 'done', comparison, saved: d.tokens, typed: t.tokens, reason };
  }

  function found(path: string): Found | null {
    const view = byPath.get(path);
    if (!view?.index || !view.search) return null;
    let count = 0;
    let ready = true;
    for (const [saved, typed] of cases) {
      const d = tokens(path, 'index', saved);
      const t = tokens(path, 'search', typed);
      const failed = [d, t].find((x) => x.status === 'error');
      if (failed && failed.status === 'error') return { found: count, total: cases.length, ready: false, error: failed.message };
      if (d.status !== 'done' || t.status !== 'done') {
        ready = false;
        continue;
      }
      if (compareTokens(d.tokens, t.tokens, 'any').result === 'found') count++;
    }
    return { found: count, total: cases.length, ready };
  }

  return { fields, tokens, test, found, progress: runner?.progress() ?? { done: 0, total: 0 } };
}

// The fields the tests run on: text and keyword fields without a problem (R3.2).
export function testableFields(fields: FieldView[]): FieldView[] {
  return fields.filter((v) => v.index && v.search);
}

// The field shown in the test section: the chosen one, or else the first text field (R3.4).
export function currentField(fields: FieldView[], chosen: string | null): FieldView | undefined {
  const list = testableFields(fields);
  return list.find((v) => v.field.path === chosen) ?? list.find((v) => v.field.kind === 'text') ?? list[0];
}
