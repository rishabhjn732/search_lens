import { useEffect, useRef, useState } from 'react';
import { useConnection } from '../../components/ConnectionProvider';
import { useWordLists } from '../../wordlists/useWordLists';
import { analyzePlaygroundStep, type PlaygroundSpec } from '../../opensearch/overview';
import { Chips } from '../MappingLab/Pieces';
import type { AnalyzeResponse, Chain, Field, Step, StepDef, Token } from '../../analysis/types';

interface Props {
  indexName: string;
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

function isSynonymStep(step: Step): boolean {
  return step.def.type === 'synonym' || step.def.type === 'synonym_graph';
}

// Joins any saved entity phrase found in the text into one token the tokenizer will not split
// (R10.4, R10.5). The underscore is only ever sent to the cluster — `displayMap` maps that
// joined form back to the phrase as typed, so a token shown to the user never carries a
// character the real analyzer did not produce.
function collapseEntities(text: string, entities: string[]): { text: string; displayMap: Map<string, string>; joined: string[] } {
  const joined: string[] = [];
  const displayMap = new Map<string, string>();
  let next = text;
  for (const entity of entities) {
    const phrase = entity.trim();
    if (!phrase || !phrase.includes(' ')) continue;
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    next = next.replace(pattern, (matched) => {
      joined.push(matched);
      const joinedForm = matched.replace(/\s+/g, '_');
      displayMap.set(joinedForm.toLowerCase(), matched);
      return joinedForm;
    });
  }
  return { text: next, displayMap, joined };
}

// Swaps a token's text back to its original spacing when it matches a joined entity,
// regardless of case changes later steps may have made (e.g. a lowercase filter).
function restoreDisplay(tokens: Token[], displayMap: Map<string, string>): Token[] {
  if (displayMap.size === 0) return tokens;
  return tokens.map((t) => {
    const display = displayMap.get(t.token.toLowerCase());
    return display ? { ...t, token: display } : t;
  });
}

type Result = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; response: AnalyzeResponse };

// R9/R10: a full view of one field's analyzer. Every run (typing, reordering, Reset, a
// source choice) asks the real cluster — see design.md "A field's analyzer playground" for
// why a browser-only copy cannot show a cluster-only filter's real effect.
export default function FieldPlayground({ indexName, field, chain, onClose }: Props) {
  const { request } = useConnection();
  const wordLists = useWordLists();
  const [text, setText] = useState('Running Shoes');
  const [filters, setFilters] = useState<Step[]>(chain.filters);
  const [synonymSources, setSynonymSources] = useState<Record<number, 'cluster' | 'saved'>>({});
  const [collapseEntitiesOn, setCollapseEntitiesOn] = useState(false);
  const [result, setResult] = useState<Result>({ status: 'loading' });
  const isReordered = filters !== chain.filters;

  const savedSynonyms = wordLists.enabledEntries('synonym');
  const savedEntities = wordLists.enabledEntries('entity');

  const { text: sentText, displayMap, joined } = collapseEntitiesOn
    ? collapseEntities(text, savedEntities)
    : { text, displayMap: new Map<string, string>(), joined: [] as string[] };

  function reset() {
    setFilters(chain.filters);
    setSynonymSources({});
  }

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setResult({ status: 'loading' });

    const specFilters: (string | StepDef)[] = filters.map((step, i) =>
      isSynonymStep(step) && synonymSources[i] === 'saved'
        ? { type: 'synonym', synonyms: savedSynonyms }
        : step.name,
    );
    const spec: PlaygroundSpec = {
      tokenizer: chain.tokenizer.name,
      charFilters: chain.charFilters.map((s) => s.name),
      filters: specFilters,
      text: sentText,
    };

    analyzePlaygroundStep(request, indexName, spec)
      .then((response) => {
        if (requestId.current === id) setResult({ status: 'ok', response });
      })
      .catch((err: unknown) => {
        if (requestId.current === id) {
          setResult({ status: 'error', message: err instanceof Error ? err.message : 'Could not run this chain.' });
        }
      });
    // savedSynonyms is derived from wordLists each render; synonymSources/filters/sentText cover
    // every user-driven change that should re-run the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexName, chain, filters, synonymSources, sentText, request]);

  return (
    <div className="field-playground" role="dialog" aria-label={`Try ${field.path}'s analyzer`}>
      <div className="playground-head">
        <h3>Try it: {field.path}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="playground-note">
        Trying text and changing the order here never changes the field&apos;s real analyzer, filters, or any
        other setting on the cluster.
      </p>

      <label className="playground-input">
        Text to try
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      {savedEntities.length > 0 && (
        <label className="playground-switch">
          <input
            type="checkbox"
            checked={collapseEntitiesOn}
            onChange={(e) => setCollapseEntitiesOn(e.target.checked)}
          />
          Collapse saved entities first
        </label>
      )}
      {collapseEntitiesOn && joined.length > 0 && (
        <p className="playground-entity-note">Joined: {joined.join(', ')}</p>
      )}

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
        {result.status === 'ok' && <Chips tokens={restoreDisplay(result.response.detail.tokenizer.tokens, displayMap)} />}
        {result.status === 'loading' && <p className="plain">Loading…</p>}
        {result.status === 'error' && <p className="try-it-error">{result.message}</p>}
      </div>

      <div className="playground-step">
        <div className="playground-step-head">
          <h4>Token filters, in order</h4>
          <button
            type="button"
            className="btn ghost small"
            disabled={!isReordered && Object.keys(synonymSources).length === 0}
            onClick={reset}
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
              {isSynonymStep(step) && savedSynonyms.length > 0 && (
                <label className="playground-source">
                  Source:
                  <select
                    value={synonymSources[i] ?? 'cluster'}
                    onChange={(e) =>
                      setSynonymSources((s) => ({ ...s, [i]: e.target.value as 'cluster' | 'saved' }))
                    }
                  >
                    <option value="cluster">Use the cluster's file</option>
                    <option value="saved">Use a saved synonym list</option>
                  </select>
                </label>
              )}
              {result.status === 'ok' && (
                <Chips tokens={restoreDisplay(result.response.detail.tokenfilters[i]?.tokens ?? [], displayMap)} />
              )}
              {result.status === 'loading' && <p className="plain">Loading…</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
