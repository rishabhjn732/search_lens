import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ListType } from '../../wordlists/rules';
import { TYPES, countText } from '../../wordlists/rules';
import { useWordLists } from '../../wordlists/useWordLists';

interface Box {
  type: ListType;
  tag: string;
  tagClass: string;
  title: string;
  what: ReactNode;
  example: ReactNode;
  choose: string;
  icon: ReactNode;
}

const BOXES: Box[] = [
  {
    type: 'entity',
    tag: 'entity',
    tagClass: 'p',
    title: 'Entities',
    what: (
      <>
        Phrases kept as one token. Example: <code>ai supplychain</code> matches only as the exact phrase.
      </>
    ),
    example: (
      <>
        <span className="c"># entity.txt, one phrase per line</span>
        {'\nai supplychain\nmachine learning\nnew york'}
      </>
    ),
    choose: 'Choose file',
    icon: (
      <>
        <rect x="3" y="12" width="34" height="16" rx="5" fill="var(--purple-bg)" stroke="var(--purple)" strokeWidth="2" />
        <line x1="20" y1="15" x2="20" y2="25" stroke="var(--purple)" strokeWidth="2" strokeDasharray="2 2" />
      </>
    ),
  },
  {
    type: 'protected',
    tag: 'keyword_marker',
    tagClass: 'y',
    title: 'Protected words',
    what: (
      <>
        Words the stemmer must not change. Example: keep <code>iPhone</code> as it is.
      </>
    ),
    example: (
      <>
        <span className="c"># protected.txt, one word per line</span>
        {'\niphone\nadidas\nrunning'}
      </>
    ),
    choose: 'Choose file',
    icon: (
      <>
        <rect x="7" y="17" width="26" height="18" rx="4" fill="var(--yellow-bg)" stroke="var(--yellow)" strokeWidth="2" />
        <path d="M13 17 V12 a7 7 0 0 1 14 0 V17" fill="none" stroke="var(--yellow)" strokeWidth="2.5" />
        <circle cx="20" cy="26" r="2.5" fill="var(--yellow)" />
      </>
    ),
  },
  {
    type: 'synonym',
    tag: 'synonym',
    tagClass: 'b',
    title: 'Synonyms',
    what: (
      <>
        Words that mean the same thing. Example: <code>sneakers</code> also finds <code>running shoes</code>.
      </>
    ),
    example: (
      <>
        <span className="c"># synonyms.txt, Solr format</span>
        {'\nsneakers, running shoes\ntv => television\nmobile, cell phone'}
      </>
    ),
    choose: 'Choose file',
    icon: (
      <>
        <rect x="3" y="8" width="16" height="11" rx="3" fill="var(--blue-bg)" stroke="var(--blue)" strokeWidth="2" />
        <rect x="21" y="21" width="16" height="11" rx="3" fill="var(--blue-bg)" stroke="var(--blue)" strokeWidth="2" />
        <path d="M22 13 h9 l-3 -3 M18 27 h-9 l3 3" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    type: 'hunspell',
    tag: 'hunspell',
    tagClass: 'g',
    title: 'Hunspell dictionary',
    what: (
      <>
        A real dictionary for stemming. Example: <code>ran</code> becomes <code>run</code>.
      </>
    ),
    example: (
      <>
        <span className="c"># two files for one language</span>
        {'\nen_US.aff   '}
        <span className="c">rules</span>
        {'\nen_US.dic   '}
        <span className="c">words</span>
      </>
    ),
    choose: 'Choose .aff and .dic',
    icon: (
      <path
        d="M6 8 h12 a3 3 0 0 1 3 3 V34 a3 3 0 0 0 -3 -3 H6 Z M34 8 h-12 a3 3 0 0 0 -3 3 V34 a3 3 0 0 1 3 -3 H34 Z"
        fill="var(--green-bg)"
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    ),
  },
];

type Result = { ok: true; text: string } | { ok: false; text: string };

function DropBox({ box }: { box: Box }) {
  const store = useWordLists();
  const [result, setResult] = useState<Result | null>(null);

  async function onChange(input: HTMLInputElement) {
    if (!input.files?.length) return;
    const r = await store.addFiles(box.type, input.files);
    input.value = '';
    if (r.ok) {
      const n = r.warnings.length;
      const dup = n ? ` (${n} duplicate ${n === 1 ? 'line' : 'lines'} skipped)` : '';
      setResult({ ok: true, text: `✓ ${r.replaced ? 'Replaced' : 'Saved'} ${r.name}: ${countText(r.count!, box.type)}${dup}. ` });
    } else {
      const e = r.errors[0];
      const m = r.errors.length - 1;
      const more = m > 0 ? ` (${m} more ${m === 1 ? 'problem' : 'problems'})` : '';
      setResult({ ok: false, text: `✕ Not saved. ${e.line ? `Line ${e.line}: ` : ''}${e.msg}${more}` });
    }
  }

  return (
    <div className={`drop${result ? (result.ok ? ' has' : ' bad') : ''}`} data-testid={`drop-${box.type}`}>
      <span className={`tag ${box.tagClass}`}>{box.tag}</span>
      <div className="top">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          {box.icon}
        </svg>
        <h3>{box.title}</h3>
      </div>
      <p className="what">{box.what}</p>
      <pre>{box.example}</pre>
      <label>
        {box.choose}
        <input
          type="file"
          accept={TYPES[box.type].accept.join(',')}
          multiple={box.type === 'hunspell'}
          aria-label={`${box.choose} for ${box.title}`}
          onChange={(e) => onChange(e.currentTarget)}
        />
      </label>
      <p className={`file${result && !result.ok ? ' bad' : ''}`} role="status">
        {result?.text}
        {result?.ok && <Link to={`/word-lists#${box.type}`}>See it in Word lists →</Link>}
      </p>
    </div>
  );
}

export default function WordListsSection() {
  return (
    <section id="lists" aria-labelledby="lists-title">
      <h2 id="lists-title">Bring your own word lists</h2>
      <p className="sub">
        Add your entities, protected words, synonyms and a Hunspell dictionary. Search Lens checks each file and saves it
        in this browser. Nothing is saved on the cluster.
      </p>
      <div className="lists">
        {BOXES.map((b) => (
          <DropBox box={b} key={b.type} />
        ))}
      </div>

      <figure
        className="compare"
        aria-label="The query iPhone sneakers. Without word lists it becomes iphon and sneaker. With word lists it becomes iphone, sneakers, running and shoes."
      >
        <div className="head">
          <span>Query</span>
          <b>iPhone sneakers</b>
          <span>· same text, two results</span>
        </div>
        <div className="cmp-row">
          <span className="who">
            Without lists<small>standard + stemmer</small>
          </span>
          <div className="chips">
            <span className="chip">
              iphon<span className="why">stemmed, wrong</span>
            </span>
            <span className="chip">
              sneaker<span className="why">stemmed</span>
            </span>
          </div>
        </div>
        <div className="cmp-row with">
          <span className="who">
            With your lists<small>+ protected, synonyms</small>
          </span>
          <div className="chips">
            <span className="chip y">
              iphone<span className="why">protected</span>
            </span>
            <span className="chip g">
              sneakers<span className="why">kept</span>
            </span>
            <span className="chip b">
              running<span className="why">synonym</span>
            </span>
            <span className="chip b">
              shoes<span className="why">synonym</span>
            </span>
          </div>
        </div>
        <div className="legend">
          <span>
            <i className="y" />
            protected word
          </span>
          <span>
            <i className="b" />
            added by a synonym
          </span>
          <span>
            <i className="g" />
            changed by Hunspell
          </span>
        </div>
      </figure>
      <p className="note">
        Your files stay in this browser and are never saved to the cluster.{' '}
        <Link to="/word-lists">See all saved word lists →</Link>
      </p>
    </section>
  );
}
