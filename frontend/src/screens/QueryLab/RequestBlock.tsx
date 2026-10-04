// The console-style request block for the query lab (spec 004, R1.3, R2.1-R2.4, R2.8).
import { useState } from 'react';
import { parseRequestBlock, type ParsedRequest, type Toggles } from '../../analysis/requestBlock';

interface Props {
  text: string;
  toggles: Toggles;
  loading: boolean;
  onChange: (text: string) => void;
  onToggle: (toggles: Toggles) => void;
  onRun: (parsed: ParsedRequest) => void;
}

export default function RequestBlock({ text, toggles, loading, onChange, onToggle, onRun }: Props) {
  const [touched, setTouched] = useState(false);
  const parsed = parseRequestBlock(text);
  const bad = touched && !parsed.ok;

  return (
    <div className="request-block">
      <div className="request-toggles">
        <label>
          <input
            type="checkbox"
            checked={toggles.explain}
            onChange={(e) => onToggle({ ...toggles, explain: e.target.checked })}
          />
          Explain
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.validate}
            onChange={(e) => onToggle({ ...toggles, validate: e.target.checked })}
          />
          Validate
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.profile}
            onChange={(e) => onToggle({ ...toggles, profile: e.target.checked })}
          />
          Profile
        </label>
      </div>

      <label className="lbl" htmlFor="request-block-text">
        Request (GET/POST, index, _search body)
      </label>
      <textarea
        id="request-block-text"
        className={bad ? 'bad' : ''}
        value={text}
        spellCheck={false}
        placeholder={'GET products/_search\n{\n  "query": { "match_all": {} }\n}'}
        aria-invalid={bad}
        aria-describedby="request-block-status"
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
      />
      {bad && (
        <p id="request-block-status" role="status" className="status bad">
          {!parsed.ok && parsed.message}
        </p>
      )}
      <button
        type="button"
        disabled={loading || (touched && !parsed.ok)}
        onClick={() => {
          setTouched(true);
          const result = parseRequestBlock(text);
          if (result.ok) onRun(result);
        }}
      >
        {loading ? 'Running…' : 'Run'}
      </button>
    </div>
  );
}
