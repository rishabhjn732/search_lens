// The browser copy of OpenSearch text analysis (spec 007). No network.
// Ported from prototypes/lab/analyzer.js. Tokens can differ a little from a real cluster;
// the screen says so (R5.1). Unknown steps pass tokens through and add a note (R7.3).
import type { AnalyzeResponse, Chain, StepDef, Token } from './types';

export const STOP_EN = new Set(
  'a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with'.split(' '),
);

const FOLD: Record<string, string> = {
  ß: 'ss', æ: 'ae', Æ: 'AE', ø: 'o', Ø: 'O', œ: 'oe', Œ: 'OE', ł: 'l', Ł: 'L',
  đ: 'd', Đ: 'D', þ: 'th', ð: 'd', å: 'a', Å: 'A',
};

export function fold(s: string): string {
  return s
    .replace(/[ßæÆøØœŒłŁđĐþðåÅ]/g, (c) => FOLD[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// A simple English stemmer, close to Porter for common shop words. `light` only removes plurals.
export function stem(w: string, light = false): string {
  if (w.length < 3) return w;
  let s = w.replace(/['’]s$/, '');
  if (/sses$/.test(s)) s = s.slice(0, -2);
  else if (/ies$/.test(s) && s.length > 4) s = s.slice(0, -3) + (light ? 'y' : 'i');
  else if (/(ch|sh|x|z)es$/.test(s)) s = s.slice(0, -2);
  else if (/[^su]s$/.test(s) && s.length > 3) s = s.slice(0, -1);
  if (light) return s;
  const hasVowel = (x: string) => /[aeiouy]/.test(x);
  const m = /^(.+?)(ing|ed)$/.exec(s);
  if (m && !/eed$/.test(s) && m[1].length >= 2 && hasVowel(m[1])) {
    s = m[1];
    if (/(at|bl|iz)$/.test(s)) s += 'e';
    else if (/([^aeioulsz])\1$/.test(s)) s = s.slice(0, -1);
  }
  if (s.length > 2 && /y$/.test(s) && hasVowel(s.slice(0, -1))) s = s.slice(0, -1) + 'i';
  return s;
}

// Inside the engine a token can carry a flag to share the position of the token before it.
type Tok = Token & { samePos?: boolean };

function tok(token: string, start: number, end: number, position: number, type?: string): Tok {
  return { token, start_offset: start, end_offset: end, type: type ?? (/^\d+$/.test(token) ? '<NUM>' : '<ALPHANUM>'), position };
}

function splitBy(re: RegExp, text: string, lower = false): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    out.push(tok(lower ? m[0].toLowerCase() : m[0], idx, idx + m[0].length, i++, 'word'));
  }
  return out;
}

const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
const flag = (v: unknown, d: boolean) => (v === undefined ? d : Boolean(v));
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []);

function grams(word: string, min: number, max: number): string[] {
  const out: string[] = [];
  for (let n = min; n <= Math.min(max, word.length); n++) out.push(word.slice(0, n));
  return out;
}

function classOk(ch: string, classes: string[]): boolean {
  return classes.some(
    (c) =>
      (c === 'letter' && /\p{L}/u.test(ch)) ||
      (c === 'digit' && /\p{N}/u.test(ch)) ||
      (c === 'whitespace' && /\s/.test(ch)) ||
      (c === 'punctuation' && /\p{P}/u.test(ch)) ||
      (c === 'symbol' && /\p{S}/u.test(ch)),
  );
}

function splitWords(t: string, classes: string[]): { w: string; s: number }[] {
  if (!classes.length) return t ? [{ w: t, s: 0 }] : [];
  const out: { w: string; s: number }[] = [];
  let cur = '';
  let start = 0;
  let idx = 0;
  for (const ch of t) {
    if (classOk(ch, classes)) {
      if (!cur) start = idx;
      cur += ch;
    } else if (cur) {
      out.push({ w: cur, s: start });
      cur = '';
    }
    idx += ch.length;
  }
  if (cur) out.push({ w: cur, s: start });
  return out;
}

interface Impl<In, Out> {
  say: string;
  run: (input: In, def: StepDef) => Out;
}

// ---- tokenizers ------------------------------------------------------------

const TOKENIZERS: Record<string, Impl<string, Tok[]>> = {
  standard: {
    say: 'Cuts the text into words at spaces and punctuation marks.',
    run: (t) =>
      splitBy(/[\p{L}\p{N}]+(?:[.'’_][\p{L}\p{N}]+)*/gu, t).map((x) => ({
        ...x,
        type: /^\d+([.,]\d+)?$/.test(x.token) ? '<NUM>' : '<ALPHANUM>',
      })),
  },
  whitespace: { say: 'Cuts the text only at spaces. Punctuation stays inside the words.', run: (t) => splitBy(/\S+/g, t) },
  letter: { say: 'Cuts the text at anything that is not a letter.', run: (t) => splitBy(/\p{L}+/gu, t) },
  lowercase: { say: 'Cuts the text at anything that is not a letter, and makes letters small.', run: (t) => splitBy(/\p{L}+/gu, t, true) },
  keyword: { say: 'Keeps the whole text as one single token. Nothing is cut.', run: (t) => (t ? [tok(t, 0, t.length, 0, 'word')] : []) },
  pattern: {
    say: 'Cuts the text where a pattern matches (by default: anything that is not a letter or digit).',
    run: (t, d) => {
      let re: RegExp;
      try {
        re = new RegExp(typeof d.pattern === 'string' ? d.pattern : '\\W+', 'gu');
      } catch {
        re = /\W+/gu;
      }
      const out: Tok[] = [];
      let last = 0;
      let i = 0;
      for (const m of t.matchAll(re)) {
        const idx = m.index ?? 0;
        if (idx > last) out.push(tok(t.slice(last, idx), last, idx, i++, 'word'));
        last = idx + m[0].length;
      }
      if (last < t.length) out.push(tok(t.slice(last), last, t.length, i++, 'word'));
      return out;
    },
  },
  edge_ngram: {
    say: 'Cuts each word into its first letters, so a few typed letters can find the whole word.',
    run: (t, d) => {
      const out: Tok[] = [];
      let i = 0;
      splitWords(t, strings(d.token_chars)).forEach((x) =>
        grams(x.w, num(d.min_gram, 1), num(d.max_gram, 2)).forEach((g) => out.push(tok(g, x.s, x.s + g.length, i++, 'word'))),
      );
      return out;
    },
  },
  ngram: {
    say: 'Cuts each word into small overlapping pieces, so a part from the middle of a word can match.',
    run: (t, d) => {
      const min = num(d.min_gram, 1);
      const max = num(d.max_gram, 2);
      const out: Tok[] = [];
      let i = 0;
      splitWords(t, strings(d.token_chars)).forEach((x) => {
        for (let a = 0; a < x.w.length; a++) {
          for (let b = min; b <= max && a + b <= x.w.length; b++) out.push(tok(x.w.slice(a, a + b), x.s + a, x.s + a + b, i++, 'word'));
        }
      });
      return out;
    },
  },
};
TOKENIZERS.classic = TOKENIZERS.standard;
TOKENIZERS.uax_url_email = TOKENIZERS.standard;

// ---- character filters -----------------------------------------------------

const CHAR_FILTERS: Record<string, Impl<string, string>> = {
  html_strip: {
    say: 'Removes HTML tags like <b> from the text.',
    run: (t) => t.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '),
  },
  mapping: {
    say: 'Swaps some characters or words for others before the text is cut.',
    run: (t, d) => {
      let out = t;
      strings(d.mappings).forEach((line) => {
        const p = line.split('=>');
        if (p.length !== 2) return;
        const from = p[0].trim();
        if (from) out = out.split(from).join(p[1].trim());
      });
      return out;
    },
  },
  pattern_replace: {
    say: 'Changes text that matches a pattern before the text is cut.',
    run: (t, d) => {
      try {
        return t.replace(new RegExp(String(d.pattern ?? ''), 'gu'), String(d.replacement ?? ''));
      } catch {
        return t;
      }
    },
  },
};

// ---- token filters ---------------------------------------------------------

function mapTokens(fn: (s: string) => string) {
  return (toks: Tok[]): Tok[] => toks.map((x) => (x.keyword ? { ...x } : { ...x, token: fn(x.token) }));
}

interface SynRule {
  lhs: string[][];
  rhs: string[][];
  replace: boolean;
}

function parseSynonyms(lines: string[]): SynRule[] {
  const words = (s: string) => fold(s.trim().toLowerCase()).split(/\s+/).filter(Boolean);
  const rules: SynRule[] = [];
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (line.includes('=>')) {
      const [l, r] = line.split('=>');
      rules.push({ lhs: l.split(',').map(words), rhs: r.split(',').map(words), replace: true });
    } else {
      const all = line.split(',').map(words);
      rules.push({ lhs: all, rhs: all, replace: false });
    }
  });
  return rules;
}

function renumber(toks: Tok[]): Tok[] {
  let pos = -1;
  return toks.map(({ samePos, ...rest }) => {
    if (!(samePos && pos >= 0)) pos++;
    return { ...rest, position: pos };
  });
}

const FILTERS: Record<string, Impl<Tok[], Tok[]>> = {
  lowercase: { say: 'Makes every letter small, so "Shoes" and "shoes" become the same word.', run: mapTokens((s) => s.toLowerCase()) },
  uppercase: { say: 'Makes every letter big.', run: mapTokens((s) => s.toUpperCase()) },
  asciifolding: { say: 'Removes accent marks, so "café" becomes "cafe".', run: mapTokens(fold) },
  stop: {
    say: 'Removes very common words like "the" and "for". They do not help the search.',
    run: (toks, d) => {
      const ic = Boolean(d.ignore_case);
      const set =
        d.stopwords === undefined || d.stopwords === '_english_'
          ? STOP_EN
          : d.stopwords === '_none_'
            ? new Set<string>()
            : new Set(strings(d.stopwords).map((w) => (ic ? w.toLowerCase() : w)));
      return toks.filter((x) => !set.has(ic ? x.token.toLowerCase() : x.token));
    },
  },
  stemmer: {
    say: 'Cuts each word to its root, so "running" and "runs" both become "run".',
    run: (toks, d) => {
      const lang = String(d.language ?? d.name ?? 'english');
      if (lang === 'possessive_english') return mapTokens((s) => s.replace(/['’]s$/i, ''))(toks);
      const light = /light|minimal|plural/.test(lang);
      return mapTokens((s) => stem(s, light))(toks);
    },
  },
  keyword_marker: {
    say: 'Protects some words, so the stemmer does not change them.',
    run: (toks, d) => {
      const ic = Boolean(d.ignore_case);
      const list = new Set(strings(d.keywords).map((w) => (ic ? w.toLowerCase() : w)));
      let re: RegExp | null = null;
      try {
        re = typeof d.keywords_pattern === 'string' ? new RegExp(d.keywords_pattern, 'u') : null;
      } catch {
        re = null;
      }
      return toks.map((x) => (list.has(ic ? x.token.toLowerCase() : x.token) || re?.test(x.token) ? { ...x, keyword: true } : x));
    },
  },
  synonym: {
    say: 'Adds words with the same meaning. "sneakers" also becomes "trainers".',
    run: (toks, d) => {
      const rules = parseSynonyms(strings(d.synonyms));
      const out: Tok[] = [];
      let i = 0;
      while (i < toks.length) {
        let best: { rule: SynRule; seq: string[]; si: number } | null = null;
        for (const rule of rules) {
          rule.lhs.forEach((seq, si) => {
            if (!seq.length || i + seq.length > toks.length) return;
            for (let k = 0; k < seq.length; k++) if (fold(toks[i + k].token.toLowerCase()) !== seq[k]) return;
            if (!best || seq.length > best.seq.length) best = { rule, seq, si };
          });
        }
        if (!best) {
          out.push(toks[i]);
          i++;
          continue;
        }
        const { rule, seq, si } = best as { rule: SynRule; seq: string[]; si: number };
        const keep = toks.slice(i, i + seq.length);
        const first = keep[0];
        if (!rule.replace) out.push(...keep);
        rule.rhs.forEach((alt, ai) => {
          if (!rule.replace && ai === si) return;
          alt.forEach((w, k) =>
            out.push({
              token: w,
              start_offset: first.start_offset,
              end_offset: keep[keep.length - 1].end_offset,
              type: 'SYNONYM',
              position: first.position + Math.min(k, seq.length - 1),
            }),
          );
        });
        i += seq.length;
      }
      return out;
    },
  },
  word_delimiter_graph: {
    say: 'Splits words at hyphens and other marks, and can also glue the parts back together, so "Wi-Fi" can match "wifi".',
    run: (toks, d) => {
      const protectedWords = new Set(strings(d.protected_words));
      const out: Tok[] = [];
      toks.forEach((x) => {
        if (protectedWords.has(x.token)) {
          out.push(x);
          return;
        }
        const parts: { w: string; s: number }[] = [];
        for (const m of x.token.matchAll(/[\p{L}\p{N}]+/gu)) {
          let sub = m[0];
          if (flag(d.split_on_case_change, true)) sub = sub.replace(/(\p{Ll})(\p{Lu})/gu, '$1\u0000$2');
          if (flag(d.split_on_numerics, true)) sub = sub.replace(/(\p{L})(\p{N})/gu, '$1\u0000$2').replace(/(\p{N})(\p{L})/gu, '$1\u0000$2');
          let off = 0;
          sub.split('\u0000').forEach((p) => {
            parts.push({ w: p, s: x.start_offset + (m.index ?? 0) + off });
            off += p.length;
          });
        }
        if (flag(d.stem_english_possessive, true) && parts.length > 1 && /^s$/i.test(parts[parts.length - 1].w) && /['’]s$/i.test(x.token)) parts.pop();
        if (parts.length <= 1) {
          out.push({ ...x, token: parts.length ? parts[0].w : x.token });
          return;
        }
        const mk = (w: string, s: number, e: number, same: boolean): Tok => ({ ...tok(w, s, e, 0, x.type), samePos: same });
        const joined = parts.map((q) => q.w).join('');
        let shareFirst = false;
        if (flag(d.preserve_original, false)) {
          out.push(mk(x.token, x.start_offset, x.end_offset, false));
          shareFirst = true;
        }
        parts.forEach((p, idx) => {
          out.push(mk(p.w, p.s, p.s + p.w.length, idx === 0 && shareFirst));
          if (idx > 0) return;
          if (flag(d.catenate_all, false)) out.push(mk(joined, x.start_offset, x.end_offset, true));
          else if (flag(d.catenate_words, false) && parts.every((q) => /^\p{L}+$/u.test(q.w))) out.push(mk(joined, x.start_offset, x.end_offset, true));
        });
      });
      return renumber(out);
    },
  },
  edge_ngram: {
    say: 'Keeps the first letters of each word (for example 2 to 5), so typing "run" can find "running".',
    run: (toks, d) => {
      const max = num(d.max_gram, 2);
      const out: Tok[] = [];
      toks.forEach((x) => {
        grams(x.token, num(d.min_gram, 1), max).forEach((g) => out.push({ ...x, token: g }));
        if (d.preserve_original && x.token.length > max) out.push(x);
      });
      return out;
    },
  },
  ngram: {
    say: 'Cuts each word into small overlapping pieces, so "melon" can find "watermelon".',
    run: (toks, d) => {
      const min = num(d.min_gram, 1);
      const max = num(d.max_gram, 2);
      const out: Tok[] = [];
      toks.forEach((x) => {
        for (let a = 0; a < x.token.length; a++) {
          for (let b = min; b <= max && a + b <= x.token.length; b++) out.push({ ...x, token: x.token.slice(a, a + b) });
        }
      });
      return out;
    },
  },
  shingle: {
    say: 'Also adds pairs of words next to each other, like "running shoes".',
    run: (toks, d) => {
      const out: Tok[] = [];
      toks.forEach((x, i) => {
        if (d.output_unigrams !== false) out.push(x);
        if (i + 1 < toks.length) out.push({ ...x, token: `${x.token} ${toks[i + 1].token}`, type: 'shingle', end_offset: toks[i + 1].end_offset });
      });
      return out;
    },
  },
  trim: { say: 'Removes spaces at the start and end of each token.', run: mapTokens((s) => s.trim()) },
  reverse: { say: 'Writes each token backwards.', run: mapTokens((s) => Array.from(s).reverse().join('')) },
  unique: {
    say: 'Removes tokens that appear twice.',
    run: (toks) => {
      const seen = new Set<string>();
      return toks.filter((x) => (seen.has(x.token) ? false : (seen.add(x.token), true)));
    },
  },
  length: {
    say: 'Removes tokens that are too short or too long.',
    run: (toks, d) => toks.filter((x) => x.token.length >= num(d.min, 0) && x.token.length <= num(d.max, Infinity)),
  },
  truncate: { say: 'Cuts long tokens to a maximum length.', run: (toks, d) => mapTokens((s) => s.slice(0, num(d.length, 10)))(toks) },
  apostrophe: { say: 'Removes everything after an apostrophe.', run: mapTokens((s) => s.replace(/['’].*$/, '')) },
  elision: {
    say: 'Removes short words glued with an apostrophe, like "l\'" in "l\'avion".',
    run: (toks, d) => {
      const arts = strings(d.articles);
      const re = new RegExp(`^(${(arts.length ? arts : ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c']).join('|')})['’]`, 'i');
      return mapTokens((s) => s.replace(re, ''))(toks);
    },
  },
  pattern_replace: {
    say: 'Changes parts of each token that match a pattern.',
    run: (toks, d) => {
      try {
        const re = new RegExp(String(d.pattern ?? ''), 'gu');
        return mapTokens((s) => s.replace(re, String(d.replacement ?? '')))(toks);
      } catch {
        return toks;
      }
    },
  },
};
FILTERS.synonym_graph = FILTERS.synonym;
FILTERS.word_delimiter = FILTERS.word_delimiter_graph;
FILTERS.porter_stem = { say: FILTERS.stemmer.say, run: (t) => FILTERS.stemmer.run(t, { type: 'stemmer', language: 'english' }) };
FILTERS.kstem = FILTERS.porter_stem;
FILTERS.snowball = FILTERS.porter_stem;

// ---- public ------------------------------------------------------------------

export type StepKind = 'char' | 'tokenizer' | 'filter';

const TABLES = { char: CHAR_FILTERS, tokenizer: TOKENIZERS, filter: FILTERS } as const;

export function isKnown(kind: StepKind, type: string): boolean {
  return Object.hasOwn(TABLES[kind], type);
}

// One plain sentence about a step (R2.2, R3.10).
export function describeStep(kind: StepKind, type: string): string {
  return isKnown(kind, type) ? TABLES[kind][type].say : 'Not copied in this page. A real cluster runs it.';
}

// Sentences for the steps this copy does not run, and how the chain was simplified (R7.3).
export function notesFor(chain: Chain): string[] {
  const notes: string[] = [];
  chain.charFilters.forEach((s) => {
    if (!isKnown('char', s.def.type)) notes.push(`Character filter "${s.name}" is not copied in this page; the text was passed through unchanged.`);
  });
  if (!isKnown('tokenizer', chain.tokenizer.def.type)) notes.push(`Tokenizer "${chain.tokenizer.name}" is not copied in this page; the standard tokenizer was used.`);
  chain.filters.forEach((s) => {
    if (!isKnown('filter', s.def.type)) notes.push(`Token filter "${s.name}" (${s.def.type}) is not copied in this page; tokens were passed through unchanged.`);
  });
  if (chain.note) notes.push(chain.note);
  return notes;
}

const clean = (toks: Tok[]): Token[] =>
  toks.map((x) => {
    const t: Token = { token: x.token, start_offset: x.start_offset, end_offset: x.end_offset, type: x.type, position: x.position };
    if (x.keyword) t.keyword = true;
    return t;
  });

// Same shape as POST /_analyze with "explain": true.
export function analyzeInBrowser(chain: Chain, text: string): AnalyzeResponse {
  let t = text;
  const charfilters = chain.charFilters.map((s) => {
    if (isKnown('char', s.def.type)) t = CHAR_FILTERS[s.def.type].run(t, s.def);
    return { name: s.name, filtered_text: [t] };
  });
  const tk = isKnown('tokenizer', chain.tokenizer.def.type) ? TOKENIZERS[chain.tokenizer.def.type] : TOKENIZERS.standard;
  let toks = tk.run(t, chain.tokenizer.def);
  const tokenizer = { name: chain.tokenizer.name, tokens: clean(toks) };
  const tokenfilters = chain.filters.map((s) => {
    if (isKnown('filter', s.def.type)) toks = FILTERS[s.def.type].run(toks, s.def);
    return { name: s.name, tokens: clean(toks) };
  });
  return { detail: { custom_analyzer: true, charfilters, tokenizer, tokenfilters } };
}

export function finalTokens(resp: AnalyzeResponse): Token[] {
  const d = resp.detail;
  return d.tokenfilters.length ? d.tokenfilters[d.tokenfilters.length - 1].tokens : d.tokenizer.tokens;
}
