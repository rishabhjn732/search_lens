import { useState } from 'react';
import type { IndexSummary } from '../../opensearch/overview';

interface Props {
  indexes: IndexSummary[];
  onOpenIndex: (name: string) => void;
}

// A search box over every index name, including system ones (R3.1-R3.4).
export default function IndexSearch({ indexes, onOpenIndex }: Props) {
  const [text, setText] = useState('');

  const matches = text.trim()
    ? indexes.filter((i) => i.name.toLowerCase().includes(text.trim().toLowerCase()))
    : [];

  // R3.3: once an index is chosen, the match list closes instead of staying open over
  // the index detail that just opened below it.
  function choose(name: string) {
    setText('');
    onOpenIndex(name);
  }

  return (
    <div className="index-search">
      <label htmlFor="index-search-box">Find an index by name</label>
      <input
        id="index-search-box"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. products"
      />
      {text.trim() && (
        matches.length > 0 ? (
          <ul className="search-results">
            {matches.map((index) => (
              <li key={index.name}>
                <button type="button" onClick={() => choose(index.name)}>
                  {index.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="search-no-match">No index matches &apos;{text.trim()}&apos;.</p>
        )
      )}
    </div>
  );
}
