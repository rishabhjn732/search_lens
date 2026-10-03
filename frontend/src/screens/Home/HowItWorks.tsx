import { demoHit } from './demoData';

// The parts of the example score. Fixed numbers for the picture; they add up to demoHit._score.
const PARTS = [
  { term: 'run', value: 4.61, colour: 'var(--blue)' },
  { term: 'shoe', value: 3.23, colour: 'var(--green)' },
];

export const READ_ONLY_SENTENCE = 'Search Lens only reads from your cluster. It never creates, changes or deletes anything.';

export default function HowItWorks() {
  const total = demoHit._score;
  return (
    <>
      <section id="how" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <p className="sub">
          Search Lens runs in your browser and talks to your cluster directly. Nothing to install on the cluster.
        </p>
        <ol className="how">
          <li>
            <h3>Connect</h3>
            <p>Give the cluster address and login. The password stays in this page&apos;s memory only.</p>
          </li>
          <li>
            <h3>Ask a question</h3>
            <p>
              Type some text or a query. For example: <code>running shoes</code>.
            </p>
          </li>
          <li>
            <h3>Read the picture</h3>
            <p>See the tokens, the matching words and each part of the score.</p>
          </li>
        </ol>
        <figure
          className="explain"
          aria-label={`Score of ${demoHit._source.title} is ${total}: ${PARTS.map((p) => `${p.term} gives ${p.value}`).join(' and ')}`}
        >
          <h3>Example: why &quot;{demoHit._source.title}&quot; scored {total.toFixed(2)}</h3>
          {PARTS.map((p) => (
            <div className="sb" key={p.term}>
              <span>
                match <code>{p.term}</code>
              </span>
              <span className="track">
                <span style={{ width: `${(p.value / total) * 100}%`, background: p.colour }} />
              </span>
              <code>{p.value.toFixed(2)}</code>
            </div>
          ))}
          <div className="sb total">
            <span>total score</span>
            <span className="track">
              <span style={{ width: '100%', background: 'var(--ink)' }} />
            </span>
            <code>{total.toFixed(2)}</code>
          </div>
        </figure>
      </section>

      <section id="safe" aria-label="Safety">
        <div className="safe">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M20 3 L34 9 V19 C34 28 27 34 20 37 C13 34 6 28 6 19 V9 Z" fill="#fff" stroke="var(--green)" strokeWidth="2.5" />
            <polyline points="13,20 18,25 27,15" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>
            <b>Read-only. Always.</b> {READ_ONLY_SENTENCE}
          </p>
        </div>
      </section>
    </>
  );
}
