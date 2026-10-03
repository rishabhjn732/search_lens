// Part 4 of the Mapping lab: the request that creates the index, to copy (spec 007, R6.1 to R6.8).
// Search Lens never sends this request.
import { useEffect, useState } from 'react';
import { checkDefinition, type Definition } from '../../analysis/definition';
import { DEFAULT_NAME, plainSummary, requestText, type Format } from './createRequest';

export default function CreateIndex({ definition }: { definition: Definition }) {
  // The name from a pasted `GET /<index>` answer (R1.2), until the user types another one.
  const [typed, setTyped] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('dev');
  const [copied, setCopied] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setTyped(null), [definition.name]);

  const name = typed ?? definition.name ?? DEFAULT_NAME;
  const text = requestText(definition, name, format);
  const refused = checkDefinition(definition).some((c) => c.level === 'problem');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ok: true, text: 'Copied. Paste it in Dev Tools and press Run.' });
    } catch {
      setCopied({ ok: false, text: 'Could not copy. Select the text and copy it by hand.' });
    }
  }

  return (
    <section className="block" id="create" aria-labelledby="ml-h-create">
      <h2 id="ml-h-create">
        <span className="step-no">4</span>Create the index
      </h2>
      <p className="sub">Happy with the results? This is the request that creates the index. You run it yourself.</p>
      <p className="never">
        <b>Search Lens never sends this request.</b> It is read-only. Copy the text and run it in Dev Tools, on a cluster where
        you are allowed to create indexes.
      </p>
      <div className="create">
        <div>
          <div className="codehead">
            <label htmlFor="ml-index-name" className="lbl">
              Index name
            </label>
            <input id="ml-index-name" type="text" autoComplete="off" spellCheck={false} value={name} onChange={(e) => setTyped(e.target.value)} />
            <div className="seg" role="group" aria-label="Format">
              <button type="button" aria-pressed={format === 'dev'} onClick={() => setFormat('dev')}>
                Dev Tools
              </button>
              <button type="button" aria-pressed={format === 'curl'} onClick={() => setFormat('curl')}>
                curl
              </button>
            </div>
            <button type="button" className="primary" onClick={copy}>
              Copy
            </button>
          </div>
          <pre className="code" aria-label="Request to copy">
            {text}
          </pre>
          {format === 'curl' && <p className="hint">Change the address and the user name to yours. curl asks for the password.</p>}
          {copied && (
            <p className={`status ${copied.ok ? 'ok' : 'bad'}`} role="status">
              {copied.text}
            </p>
          )}
        </div>
        <div className="what">
          <h3>What this creates, in plain words</h3>
          <ul>
            {plainSummary(definition, name).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {refused && <p className="status bad">OpenSearch will refuse this index: fix the red problems in step 2 first.</p>}
        </div>
      </div>
    </section>
  );
}
