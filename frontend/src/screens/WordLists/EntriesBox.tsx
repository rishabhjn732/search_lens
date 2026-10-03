import { useState } from 'react';
import type { ListType } from '../../wordlists/rules';
import type { SavedFile } from '../../wordlists/samples';
import { useWordLists } from '../../wordlists/useWordLists';
import Message, { type MessageData } from './Message';

const PAGE = 20;

const HEADS: Record<ListType, string[]> = {
  entity: ['Entity', 'Becomes one token'],
  protected: ['Word'],
  synonym: ['Rule', 'Type'],
  hunspell: ['Word'],
};

const EXAMPLE: Record<Exclude<ListType, 'hunspell'>, string> = {
  entity: 'add an entity, for example: data lake',
  protected: 'add a word, for example: wifi',
  synonym: 'add a rule, for example: couch, sofa',
};

export default function EntriesBox({ type, file }: { type: ListType; file: SavedFile | undefined }) {
  const store = useWordLists();
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<MessageData | null>(null);

  if (!file) {
    return (
      <div className="box">
        <h3>Entries</h3>
        <p className="empty">Add a file to see its entries here.</p>
      </div>
    );
  }

  const f = file;
  const q = filter.toLowerCase();
  const shown = f.entries.filter((e) => e.includes(q));

  function add() {
    const err = store.addEntry(f.id, draft);
    if (err) {
      setMsg({ kind: 'err', title: err }); // keep the typed text so the user can fix it
    } else {
      setMsg({ kind: 'ok', title: `Added to ${f.name}.` });
      setDraft('');
    }
  }

  function remove(entry: string) {
    const err = store.removeEntry(f.id, entry);
    setMsg(err ? { kind: 'err', title: err } : { kind: 'ok', title: `Removed "${entry}".` });
  }

  return (
    <div className="box">
      <h3>
        {f.name}
        <span className="sr-only">, </span>
        <small>
          showing {Math.min(PAGE, shown.length)} of {shown.length}
        </small>
      </h3>
      <div className="filter">
        <input type="search" placeholder="Filter entries" aria-label="Filter entries" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <table>
        <thead>
          <tr>
            {HEADS[type].map((h) => (
              <th key={h}>{h}</th>
            ))}
            {type !== 'hunspell' && (
              <th>
                <span className="sr-only">Remove</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {shown.slice(0, PAGE).map((e) => (
            <tr key={e}>
              <td>{e}</td>
              {type === 'entity' && (
                <td>
                  <code>{e}</code>
                </td>
              )}
              {type === 'synonym' && <td>{e.includes('=>') ? 'one way' : 'both ways'}</td>}
              {type !== 'hunspell' && (
                <td className="x">
                  <button className="icon-btn" aria-label={`Remove ${e}`} title="Remove" onClick={() => remove(e)}>
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={3}>Nothing matches &quot;{filter}&quot;.</td>
            </tr>
          )}
        </tbody>
      </table>
      {type === 'hunspell' ? (
        <p className="empty">Words come from the .dic file. To change them, edit the file and add it again.</p>
      ) : (
        <div className="add">
          <input
            placeholder={EXAMPLE[type]}
            aria-label={`New entry for ${f.name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button onClick={add}>Add</button>
        </div>
      )}
      {msg && <Message msg={msg} />}
    </div>
  );
}
