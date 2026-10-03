// The box for the index definition and its status line (spec 007, R1.1, R1.3, R1.5, R1.7).
import type { ReadError } from '../../analysis/definition';

export type Status =
  | { kind: 'empty' }
  | { kind: 'error'; error: ReadError }
  | { kind: 'ok'; fields: number; analyzers: number; problems: number };

export function statusText(status: Status): string {
  if (status.kind === 'empty') return 'Paste an index definition, or pick an example.';
  if (status.kind === 'error') {
    const { error } = status;
    return error.line ? `Cannot read this yet. Line ${error.line}, column ${error.col}: ${error.message}` : error.message;
  }
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const base = `Read ${plural(status.fields, 'field')} and ${plural(status.analyzers, 'analyzer')} you made.`;
  return status.problems
    ? `${base} ${plural(status.problems, 'problem')} to fix: see the red notes below.`
    : base;
}

interface Props {
  text: string;
  status: Status;
  storageMessage: string | null;
  onChange: (text: string) => void;
  onTidy: () => void;
  onClear: () => void;
}

export default function PasteBox({ text, status, storageMessage, onChange, onTidy, onClear }: Props) {
  const bad = status.kind === 'error' || (status.kind === 'ok' && status.problems > 0);
  return (
    <div className="editor">
      <label className="lbl" htmlFor="ml-source">
        Index definition (JSON)
      </label>
      <textarea
        id="ml-source"
        value={text}
        spellCheck={false}
        aria-describedby="ml-status"
        onChange={(e) => onChange(e.target.value)}
      />
      <p id="ml-status" role="status" className={`status${status.kind === 'empty' ? '' : bad ? ' bad' : ' ok'}`}>
        {status.kind === 'ok' && !bad ? '✓ ' : status.kind === 'empty' ? '' : bad ? '✕ ' : ''}
        {statusText(status)}
      </p>
      {storageMessage && <p className="status bad">{storageMessage}</p>}
      <div className="tools">
        <button type="button" className="small" onClick={onTidy}>
          Tidy the JSON
        </button>
        <button type="button" className="small" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
