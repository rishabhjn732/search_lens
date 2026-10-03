import type { ReactNode } from 'react';
import type { ListType } from '../../wordlists/rules';

export const COLOURS: Record<ListType, { bg: string; line: string }> = {
  entity: { bg: 'var(--purple-bg)', line: 'var(--purple)' },
  protected: { bg: 'var(--yellow-bg)', line: 'var(--yellow)' },
  synonym: { bg: 'var(--blue-bg)', line: 'var(--blue)' },
  hunspell: { bg: 'var(--green-bg)', line: 'var(--green)' },
};

export function FileIcon({ type }: { type: ListType }) {
  const c = COLOURS[type];
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
      <path d="M2 2 h12 l6 6 v16 h-18 Z" fill={c.bg} stroke={c.line} strokeWidth="1.5" />
    </svg>
  );
}

export const HELP: Record<ListType, ReactNode> = {
  entity: (
    <>
      <p>One phrase per line, two or more words. Lines that start with # are comments.</p>
      <pre>{'# entity.txt\nai supplychain\nmachine learning\nnew york'}</pre>
    </>
  ),
  protected: (
    <>
      <p>
        The stemmer does not change these words. For example, <code>iphone</code> stays <code>iphone</code>, not{' '}
        <code>iphon</code>. One word per line.
      </p>
      <pre>{'# protected.txt\niphone\nadidas\nkubernetes'}</pre>
    </>
  ),
  synonym: (
    <>
      <p>
        <code>a, b</code> means both words find each other. <code>a =&gt; b</code> means <code>a</code> is replaced by{' '}
        <code>b</code>.
      </p>
      <pre>{'# synonyms.txt, Solr format\nsneakers, running shoes\ntv => television'}</pre>
    </>
  ),
  hunspell: (
    <>
      <p>
        A real dictionary finds the base word, for example <code>ran</code> becomes <code>run</code>. Choose the two
        files together. The first line of the .dic file is the number of words.
      </p>
      <pre>{'en_US.aff   rules\nen_US.dic   words'}</pre>
    </>
  ),
};

export function ago(ts: number, now = Date.now()): string {
  const s = (now - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
