// Comparing saved tokens with typed tokens, and saying in plain words why a search is not found
// (spec 007, R3.5, R3.9). Also the one-sentence summary of a chain (R2.2). No network.
// Ported from prototypes/lab/analyzer.js and mapping-lab.html.
import { chainFor, listFields, type Definition } from './definition';
import { analyzeInBrowser, finalTokens, fold, stem } from './engine';
import type { Chain, Step, Token } from './types';

export type MatchMode = 'any' | 'all';
export type MatchResult = 'found' | 'partly' | 'not_found' | 'nothing_left';

export interface Comparison {
  result: MatchResult;
  found: string[];
  missing: string[];
  // typed "words": tokens at the same position (synonyms) count as one
  words: number;
  foundWords: number;
  // the typed words that were not found, each as the tokens at its position
  unfound: string[][];
}

export function compareTokens(saved: Token[], typed: Token[], mode: MatchMode): Comparison {
  const savedSet = new Set(saved.map((t) => t.token));
  const unique: Token[] = [];
  const seen = new Set<string>();
  typed.forEach((t) => {
    if (!seen.has(t.token)) {
      seen.add(t.token);
      unique.push(t);
    }
  });
  const byPos = new Map<number, string[]>();
  unique.forEach((t) => byPos.set(t.position, [...(byPos.get(t.position) ?? []), t.token]));
  const groups = [...byPos.values()];
  const unfound = groups.filter((g) => !g.some((t) => savedSet.has(t)));
  const foundWords = groups.length - unfound.length;
  const found = unique.filter((t) => savedSet.has(t.token)).map((t) => t.token);
  const missing = unique.filter((t) => !savedSet.has(t.token)).map((t) => t.token);
  let result: MatchResult;
  if (!groups.length) result = 'nothing_left';
  else if (foundWords === groups.length) result = 'found';
  else if (foundWords === 0 || mode === 'all') result = 'not_found';
  else result = 'partly';
  return { result, found, missing, words: groups.length, foundWords, unfound };
}

// ---- reasons (R3.9) -------------------------------------------------------------

export type Fix = 'lowercase' | 'asciifolding' | 'word_delimiter_graph' | 'stemmer' | 'edge_ngram' | 'ngram' | 'fuzziness' | 'stop' | 'synonym';

export interface Reason {
  fix: Fix;
  text: string;
}

export const NOTHING_LEFT: Reason = {
  fix: 'stop',
  text: 'Every typed word was removed (for example by the stop filter), so there is nothing left to search for.',
};

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// One reason why the typed token `q` is not among the saved tokens.
export function reasonFor(q: string, saved: Token[]): Reason {
  const docs = saved.map((t) => t.token);
  const low = (s: string) => s.toLowerCase();
  let d: string | undefined;
  if ((d = docs.find((x) => x !== q && low(x) === low(q)))) {
    return { fix: 'lowercase', text: `"${q}" and "${d}" differ only in big and small letters. Add the lowercase filter.` };
  }
  if ((d = docs.find((x) => x !== q && fold(low(x)) === fold(low(q))))) {
    return { fix: 'asciifolding', text: `"${q}" and "${d}" differ only in accents. Add the asciifolding filter.` };
  }
  const pair = docs.findIndex((x, i) => i + 1 < docs.length && x + docs[i + 1] === q);
  if (pair >= 0) {
    return {
      fix: 'word_delimiter_graph',
      text: `The document has "${docs[pair]}" and "${docs[pair + 1]}" as two words; the search has "${q}" as one. word_delimiter_graph with catenate_all glues them.`,
    };
  }
  if ((d = docs.find((x) => x.length > q.length && x.startsWith(q)))) {
    if (stem(d) === stem(q) || stem(d, true) === stem(q, true)) {
      return { fix: 'stemmer', text: `"${q}" and "${d}" are forms of the same word. A stemmer makes them equal.` };
    }
    return { fix: 'edge_ngram', text: `"${q}" is the start of "${d}". Saving the first letters of each word (edge_ngram) lets a half-typed word match.` };
  }
  if ((d = docs.find((x) => q.length > x.length && q.startsWith(x) && q.length - x.length <= 3))) {
    return { fix: 'stemmer', text: `"${q}" and "${d}" look like forms of the same word. A stemmer makes them equal.` };
  }
  if ((d = docs.find((x) => x.length > q.length + 1 && x.indexOf(q) > 0))) {
    return { fix: 'ngram', text: `"${q}" is inside "${d}", not at its start. Only small pieces (ngram) can find a word from the middle.` };
  }
  if (q.length > 3 && (d = docs.find((x) => x.length > 3 && (editDistance(x, q) <= 2 || editDistance(x, stem(q)) <= 1)))) {
    return { fix: 'fuzziness', text: `"${q}" looks like a typo of "${d}". Use "fuzziness": "AUTO" in the match query.` };
  }
  if (docs.includes(q.replace(/[^\p{L}\p{N}]/gu, ''))) {
    return { fix: 'word_delimiter_graph', text: `"${q}" has marks like - or & that the document does not. Remove them in both, with word_delimiter_graph or a mapping char filter.` };
  }
  return { fix: 'synonym', text: `The document has no word like "${q}". If they mean the same thing, add a synonym.` };
}

// ---- the one sentence about a chain (R2.2) -------------------------------------------

const PLAIN: Record<string, string> = {
  html_strip: 'HTML removed', mapping: 'symbols swapped', pattern_replace: 'text replaced',
  standard: 'cut into words', classic: 'cut into words', uax_url_email: 'cut into words', whitespace: 'cut at spaces',
  keyword: 'kept whole', letter: 'cut at non-letters', pattern: 'cut by a pattern',
  uppercase: 'big letters', asciifolding: 'accents removed', stop: 'little words removed',
  stemmer: 'cut to the root', porter_stem: 'cut to the root', kstem: 'cut to the root', snowball: 'cut to the root',
  keyword_marker: 'some words protected', synonym: 'synonyms added', synonym_graph: 'synonyms added',
  word_delimiter: 'split at hyphens', word_delimiter_graph: 'split at hyphens', edge_ngram: 'first letters saved',
  ngram: 'small pieces saved', shingle: 'word pairs added', unique: 'repeats removed', hunspell: 'dictionary roots',
  trim: 'spaces trimmed', length: 'short or long tokens removed', elision: "l' and d' removed",
  apostrophe: 'apostrophes cut', reverse: 'written backwards', truncate: 'long tokens cut',
};

function plainStep(s: Step, isTokenizer: boolean): string {
  if (s.def.type === 'stemmer' && s.def.language === 'possessive_english') return "'s removed";
  if (s.def.type === 'lowercase') return isTokenizer ? 'cut at non-letters, small letters' : 'small letters';
  return PLAIN[s.def.type] ?? s.def.type;
}

export function plainChain(chain: Chain): string {
  const parts = [
    ...chain.charFilters.map((s) => plainStep(s, false)),
    plainStep(chain.tokenizer, true),
    ...chain.filters.map((s) => plainStep(s, false)),
  ];
  const s = parts.join(', then ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

// ---- how many tests one field finds (R1.6, R3.6) ----------------------------------------

// Runs every test through one field with the browser copy and counts the ones that are found.
export function countFound(def: Definition, path: string, mode: MatchMode, cases: [saved: string, typed: string][]): number {
  const field = listFields(def.mappings, def.analysis).find((f) => f.path === path);
  if (!field) throw new Error(`no field ${path}`);
  const index = chainFor(field, 'index', def.analysis);
  const search = chainFor(field, 'search', def.analysis);
  if (!index || !search || 'error' in index || 'error' in search) throw new Error(`no chain for ${path}`);
  return cases.filter(([saved, typed]) => {
    const s = finalTokens(analyzeInBrowser(index, saved));
    const t = finalTokens(analyzeInBrowser(search, typed));
    return compareTokens(s, t, mode).result === 'found';
  }).length;
}

// The most tests that any text field finds, with "any word" (R1.6). Used for the example list.
export function bestFieldFinds(def: Definition, cases: [saved: string, typed: string][]): number {
  return listFields(def.mappings, def.analysis)
    .filter((f) => f.kind === 'text')
    .reduce((best, f) => {
      const index = chainFor(f, 'index', def.analysis);
      const search = chainFor(f, 'search', def.analysis);
      if (!index || !search || 'error' in index || 'error' in search) return best;
      return Math.max(best, countFound(def, f.path, 'any', cases));
    }, 0);
}
