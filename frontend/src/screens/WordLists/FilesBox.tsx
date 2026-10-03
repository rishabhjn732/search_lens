import type { ListType } from '../../wordlists/rules';
import { TYPES, countText } from '../../wordlists/rules';
import { useWordLists } from '../../wordlists/useWordLists';
import Message, { type MessageData } from './Message';
import { FileIcon, HELP, ago } from './help';

interface Props {
  type: ListType;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  message: MessageData | null;
  onMessage: (msg: MessageData | null) => void;
}

export default function FilesBox({ type, selectedId, onSelect, message, onMessage }: Props) {
  const store = useWordLists();
  const files = store.list(type);

  async function onChoose(input: HTMLInputElement) {
    if (!input.files?.length) return;
    const r = await store.addFiles(type, input.files);
    input.value = '';
    const warns = r.warnings.map((w) => ({ ...w, warn: true }));
    if (r.ok) {
      onSelect(r.id!);
      onMessage({ kind: 'ok', title: `${r.replaced ? 'Replaced' : 'Saved'} ${r.name}: ${countText(r.count!, type)}.`, items: warns });
    } else {
      const n = r.errors.length;
      onMessage({
        kind: 'err',
        title: `Not saved. ${r.name} has ${n} ${n === 1 ? 'problem' : 'problems'}:`,
        items: [...r.errors, ...warns],
      });
    }
  }

  function onRemove(id: string, name: string, count: number) {
    if (!window.confirm(`Remove ${name}? Its ${countText(count, type)} will be deleted from this browser.`)) return;
    const err = store.remove(id);
    onMessage(err ? { kind: 'err', title: err } : { kind: 'ok', title: `Removed ${name}.` });
  }

  function onToggle(id: string) {
    const err = store.toggle(id);
    onMessage(err ? { kind: 'err', title: err } : null);
  }

  return (
    <div className="box">
      <h3>
        {type === 'hunspell' ? 'Dictionaries' : 'Saved files'}
        <small>{files.length === 1 ? '1 file' : `${files.length} files`}</small>
      </h3>
      {files.length === 0 ? (
        <p className="empty">No files yet. Add one to start.</p>
      ) : (
        <ul className="files">
          {files.map((f) => (
            <li key={f.id} className={[f.id === selectedId ? 'sel' : '', f.enabled ? '' : 'off'].join(' ').trim() || undefined}>
              <FileIcon type={type} />
              <button className="name" title="Show entries" onClick={() => onSelect(f.id)}>
                {f.name}
                <span className="sr-only">, </span>
                <span className="meta">
                  {countText(f.entries.length, type)} · {ago(f.updated)}
                  {f.enabled ? '' : ' · off'}
                </span>
              </button>
              <button
                className="switch"
                role="switch"
                aria-checked={f.enabled}
                aria-label={`Use ${f.name}`}
                onClick={() => onToggle(f.id)}
              />
              <button
                className="icon-btn"
                aria-label={`Remove ${f.name}`}
                title="Remove"
                onClick={() => onRemove(f.id, f.name, f.entries.length)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="add-file">
        <label className="btn small">
          {type === 'hunspell' ? 'Add .aff + .dic' : 'Add file'}
          <input
            id={`file-${type}`}
            type="file"
            accept={TYPES[type].accept.join(',')}
            multiple={type === 'hunspell'}
            onChange={(e) => onChoose(e.currentTarget)}
          />
        </label>
        <span className="hint">{TYPES[type].hint}</span>
      </div>
      {message && <Message msg={message} />}
      <div className="explain">{HELP[type]}</div>
    </div>
  );
}
