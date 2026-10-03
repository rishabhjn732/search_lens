// Things to check before creating the index, in three levels (spec 007, R2.6).
import type { Check } from '../../analysis/definition';

const MARK = { problem: '✕', warning: '!', tip: 'i' } as const;
const NAME = { problem: 'Problem', warning: 'Warning', tip: 'Tip' } as const;

export default function ChecksList({ checks }: { checks: Check[] }) {
  if (!checks.length) return null;
  return (
    <ul className="checks" aria-label="Things to check">
      {checks.map((c, i) => (
        <li key={i} className={c.level}>
          <span className="ic" aria-hidden="true">
            {MARK[c.level]}
          </span>
          <span>
            <span className="sr-only">{NAME[c.level]}: </span>
            {c.field && (
              <>
                <code>{c.field}</code>
                {': '}
              </>
            )}
            <span className="msg">{c.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
