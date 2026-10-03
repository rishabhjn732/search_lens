import { useState } from 'react';
import type { Token } from '../../analysis/types';
import { ClusterError } from '../../opensearch/errors';

interface Props {
  onTry: (text: string) => Promise<Token[]>;
}

type Result = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; tokens: Token[] };

// One field's "try it" box (R4.4): typed text goes straight to the cluster's real analyzer.
export default function TryItBox({ onTry }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result>({ status: 'idle' });

  async function run() {
    setResult({ status: 'loading' });
    try {
      const tokens = await onTry(text);
      setResult({ status: 'ok', tokens });
    } catch (err) {
      setResult({ status: 'error', message: err instanceof ClusterError ? err.message : 'Could not try this field.' });
    }
  }

  return (
    <div className="try-it-box">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Try some text"
        aria-label="Text to try"
      />
      <button type="button" className="btn ghost small" onClick={run} disabled={!text || result.status === 'loading'}>
        Try it
      </button>
      {result.status === 'error' && <p className="try-it-error">{result.message}</p>}
      {result.status === 'ok' && (
        <p className="try-it-tokens">
          {result.tokens.map((t) => (
            <span key={`${t.position}-${t.token}`} className="token">
              {t.token}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
