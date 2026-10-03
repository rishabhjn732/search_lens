// Add a test of your own (spec 007, R3.11).
import { useState } from 'react';

export default function OwnTestForm({ onAdd }: { onAdd: (saved: string, typed: string) => string | null }) {
  const [saved, setSaved] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = onAdd(saved, typed);
    setError(err);
    if (!err) {
      setSaved('');
      setTyped('');
    }
  }

  return (
    <form className="mine" onSubmit={submit}>
      <div>
        <label className="lbl" htmlFor="ml-own-saved">
          Your own test: saved text
        </label>
        <input id="ml-own-saved" type="text" placeholder="Nike Air Zoom Pegasus 40" autoComplete="off" value={saved} onChange={(e) => setSaved(e.target.value)} />
      </div>
      <div>
        <label className="lbl" htmlFor="ml-own-typed">
          What the shopper types
        </label>
        <input id="ml-own-typed" type="text" placeholder="pegasus running" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <button type="submit" className="primary">
        Add test
      </button>
      {error && (
        <p className="status bad full" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
