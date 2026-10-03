import { useState } from 'react';
import { useWordLists } from '../../wordlists/useWordLists';

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Joins entity phrases into one token. Longest entity first (R3.2).
export function joinEntities(text: string[], entities: string[]): { tokens: string[]; found: string[] } {
  const ents = entities.map(words).sort((a, b) => b.length - a.length);
  const tokens: string[] = [];
  const found: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = ents.find((p) => p.every((w, k) => text[i + k] === w));
    if (hit) {
      tokens.push(hit.join(' '));
      found.push(hit.join(' '));
      i += hit.length - 1;
    } else tokens.push(text[i]);
  }
  return { tokens, found };
}

export function MergePicture() {
  return (
    <svg className="merge" viewBox="0 0 420 110" role="img" aria-label="The words ai and supplychain join into one token: ai supplychain">
      <g className="w">
        <rect x="40" y="14" width="60" height="34" rx="7" fill="var(--board)" stroke="var(--line)" strokeWidth="1.5" />
        <text x="70" y="36" textAnchor="middle">ai</text>
      </g>
      <g className="w w2">
        <rect x="120" y="14" width="130" height="34" rx="7" fill="var(--board)" stroke="var(--line)" strokeWidth="1.5" />
        <text x="185" y="36" textAnchor="middle">supplychain</text>
      </g>
      <text x="285" y="37" className="note-text">2 tokens</text>
      <g className="one">
        <rect x="40" y="62" width="210" height="38" rx="7" fill="var(--purple-bg)" stroke="var(--purple)" strokeWidth="2" />
        <text x="145" y="86" textAnchor="middle" className="purple">ai supplychain</text>
        <text x="285" y="86" className="purple">1 token</text>
      </g>
    </svg>
  );
}

export default function EntityTry() {
  const store = useWordLists();
  const [value, setValue] = useState('New AI SupplyChain platform for retail');
  const text = words(value);
  const anyOn = store.list('entity').some((f) => f.enabled);
  const { tokens, found } = joinEntities(text, store.enabledEntries('entity'));

  let message: string;
  if (!anyOn) message = 'No entity file is on. Turn one on to see entities join.';
  else if (!found.length) message = 'No entity found in this text. Try "ai supplychain" or "new york".';
  else message = `${text.length} tokens became ${tokens.length}. "${found[0]}" is one token, so only the exact phrase matches it.`;

  return (
    <div className="box">
      <h3>
        Try it <small>uses the files that are on</small>
      </h3>
      <div className="try">
        <label htmlFor="ent-in">Type some text</label>
        <input id="ent-in" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="lane">
          <span className="lbl">normal</span>
          <div className="chips" data-testid="plain-tokens">
            {text.map((w, i) => (
              <span className="chip" key={i}>
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="lane">
          <span className="lbl">with entities</span>
          <div className="chips" data-testid="joined-tokens">
            {tokens.map((t, i) =>
              found.includes(t) && t.includes(' ') ? (
                <span className="chip p" key={i}>
                  {t}
                  <span className="why">entity</span>
                </span>
              ) : (
                <span className="chip" key={i}>
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
        <p className="join" role="status">
          {message}
        </p>
      </div>
    </div>
  );
}
