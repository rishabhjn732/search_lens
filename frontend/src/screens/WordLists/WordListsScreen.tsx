import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ListType } from '../../wordlists/rules';
import { LIST_TYPES, TYPES } from '../../wordlists/rules';
import { QUOTA, formatSize } from '../../wordlists/store';
import { useWordLists } from '../../wordlists/useWordLists';
import EntityTry, { MergePicture } from './EntityTry';
import EntriesBox from './EntriesBox';
import FilesBox from './FilesBox';
import type { MessageData } from './Message';
import { COLOURS } from './help';
import './wordlists.css';

const TILE_TEXT: Record<ListType, string> = {
  entity: 'entities',
  protected: 'protected words',
  synonym: 'synonym rules',
  hunspell: 'Hunspell dictionaries',
};

function tabFromHash(hash: string): ListType {
  const t = hash.replace('#', '') as ListType;
  return LIST_TYPES.includes(t) ? t : 'entity';
}

export default function WordListsScreen() {
  const store = useWordLists();
  const location = useLocation();
  const [tab, setTab] = useState<ListType>(() => tabFromHash(location.hash));
  const [selected, setSelected] = useState<Partial<Record<ListType, string>>>({});
  const [messages, setMessages] = useState<Partial<Record<ListType, MessageData | null>>>({});

  useEffect(() => {
    if (location.hash) setTab(tabFromHash(location.hash));
  }, [location.hash]);

  const count = (type: ListType) => {
    const files = store.list(type);
    return type === 'hunspell' ? files.length : files.reduce((n, f) => n + f.entries.length, 0);
  };

  const files = store.list(tab);
  const file = files.find((f) => f.id === selected[tab]) ?? files[0];

  const used = store.used();
  const pct = Math.min(100, (used / QUOTA) * 100);

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    const t = LIST_TYPES[(next + LIST_TYPES.length) % LIST_TYPES.length];
    setTab(t);
    document.getElementById(`t-${t}`)?.focus();
  }

  function onReset() {
    if (!window.confirm('Delete all your lists in this browser and load the sample data again?')) return;
    store.reset();
    setSelected({});
    setMessages({});
  }

  return (
    <div className="wordlists wrap">
      <div className="top">
        <div>
          <h1>Word lists</h1>
          <p className="lead">
            Your saved entities, protected words, synonyms and dictionaries. Turn a file on, and the Token playground and
            Query lab use it.
          </p>
        </div>
        <div className="actions">
          <button className="btn small ghost" onClick={onReset}>
            Reset sample data
          </button>
          <button className="btn small primary" onClick={() => document.getElementById(`file-${tab}`)?.click()}>
            Add file
          </button>
        </div>
      </div>

      <div className={`meter${pct > 95 ? ' full' : pct > 80 ? ' warn' : ''}`}>
        <span>Browser storage</span>
        <span className="track" aria-hidden="true">
          <span style={{ width: `${Math.max(pct, 1)}%` }} />
        </span>
        <span>
          {formatSize(used)} of about {formatSize(QUOTA)} used
        </span>
      </div>

      <div className="tiles">
        {LIST_TYPES.map((t) => (
          <button className="tile" key={t} onClick={() => setTab(t)}>
            <span className="dot" style={{ background: COLOURS[t].bg, borderColor: COLOURS[t].line }} aria-hidden="true" />
            <span>
              <b>{count(t)}</b>
              <span>{TILE_TEXT[t]}</span>
            </span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="List types">
        {LIST_TYPES.map((t, i) => (
          <button
            key={t}
            role="tab"
            id={`t-${t}`}
            aria-controls={`p-${t}`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            style={{ ['--c' as string]: COLOURS[t].line }}
            onClick={() => setTab(t)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {TYPES[t].label} <span className="count">{count(t)}</span>
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`p-${tab}`} aria-labelledby={`t-${tab}`} style={{ ['--c' as string]: COLOURS[tab].line }}>
        <div className="panel-grid">
          <div>
            {tab === 'entity' && (
              <div className="box gap">
                <h3>What is an entity?</h3>
                <div className="explain first">
                  <p>
                    A group of words that means one thing. Search Lens keeps it together as <b>one token</b>, and a
                    query matches it only as the exact phrase.
                  </p>
                  <MergePicture />
                </div>
              </div>
            )}
            <FilesBox
              key={tab}
              type={tab}
              selectedId={file?.id}
              onSelect={(id) => setSelected((s) => ({ ...s, [tab]: id }))}
              message={messages[tab] ?? null}
              onMessage={(m) => setMessages((s) => ({ ...s, [tab]: m }))}
            />
          </div>
          <div>
            {tab === 'entity' && (
              <div className="gap">
                <EntityTry />
              </div>
            )}
            <EntriesBox key={file?.id ?? tab} type={tab} file={file} />
          </div>
        </div>
      </section>

      <p className="note">
        Lists are saved in this browser (localStorage), not on the cluster. They are never sent over the network.
      </p>
    </div>
  );
}
