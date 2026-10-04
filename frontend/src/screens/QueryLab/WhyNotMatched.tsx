// "Why the others did not match" box (spec 004, R5.1-R5.3).
import { useState } from 'react';
import { explainDoc, type Request } from '../../opensearch/querylab';

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'matched'; reason: string }
  | { kind: 'not_matched'; reason: string }
  | { kind: 'not_found'; docId: string };

function missReason(description: string): string {
  return description;
}

interface Props {
  request: Request;
  indexName: string;
  query: unknown;
}

export default function WhyNotMatched({ request, indexName, query }: Props) {
  const [docId, setDocId] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  async function check() {
    const id = docId.trim();
    if (!id) return;
    setResult({ kind: 'loading' });
    const outcome = await explainDoc(request, indexName, query, id);
    if (outcome.kind === 'not_found') {
      setResult({ kind: 'not_found', docId: id });
    } else if (outcome.kind === 'matched') {
      setResult({ kind: 'matched', reason: missReason(outcome.explanation.description) });
    } else {
      setResult({ kind: 'not_matched', reason: missReason(outcome.explanation.description) });
    }
  }

  return (
    <section className="why-not-matched" aria-label="Why the others did not match">
      <h3>Why the others did not match</h3>
      <label className="lbl" htmlFor="why-not-matched-id">
        Document id
      </label>
      <div className="why-not-matched-row">
        <input
          id="why-not-matched-id"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
        />
        <button type="button" onClick={check} disabled={result.kind === 'loading'}>
          Check
        </button>
      </div>
      {result.kind === 'not_found' && <p className="status bad">No document with id '{result.docId}' in this index.</p>}
      {result.kind === 'matched' && <p className="status ok">This document matched: {result.reason}</p>}
      {result.kind === 'not_matched' && <p className="status bad">{result.reason}</p>}
    </section>
  );
}
