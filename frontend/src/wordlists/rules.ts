// Line checks for word list files. Pure functions: no browser storage, no network.
// Messages are the ones in specs/006-custom-word-lists/design.md, word for word.

export type ListType = 'entity' | 'protected' | 'synonym' | 'hunspell';

export const LIST_TYPES: ListType[] = ['entity', 'protected', 'synonym', 'hunspell'];

export interface TypeInfo {
  label: string;
  one: string;
  many: string;
  accept: string[];
  hint: string;
}

export const TYPES: Record<ListType, TypeInfo> = {
  entity: { label: 'Entities', one: 'entity', many: 'entities', accept: ['.txt'], hint: '.txt, one phrase per line' },
  protected: { label: 'Protected words', one: 'word', many: 'words', accept: ['.txt'], hint: '.txt, one word per line' },
  synonym: { label: 'Synonyms', one: 'rule', many: 'rules', accept: ['.txt'], hint: '.txt, Solr format' },
  hunspell: { label: 'Hunspell', one: 'word', many: 'words', accept: ['.aff', '.dic'], hint: 'choose the .aff and .dic together' },
};

export function countText(n: number, type: ListType): string {
  const t = TYPES[type];
  return `${n} ${n === 1 ? t.one : t.many}`;
}

export interface Problem {
  line: number; // 0 when the problem is about the whole file
  msg: string;
}

export interface ParseResult {
  errors: Problem[];
  warnings: Problem[];
  entries: string[];
  name?: string;
}

export interface TextFile {
  name: string;
  text: string;
}

const WORD = /^[\p{L}\p{N}][\p{L}\p{N}'._-]*$/u;

export function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normaliseSynonym(s: string): string {
  return s
    .split('=>')
    .map((side) => side.split(',').map(normalise).join(', '))
    .join(' => ');
}

export function normaliseFor(type: ListType, s: string): string {
  return type === 'synonym' ? normaliseSynonym(s) : normalise(s);
}

function notAllowed(word: string): string {
  return `"${word}" has a character that is not allowed. Use letters, numbers, - _ . or '.`;
}

// Returns an error sentence, or null when the (already normalised) line is fine.
export function checkLine(type: Exclude<ListType, 'hunspell'>, s: string): string | null {
  if (type === 'protected') {
    if (s.includes(' ')) return `"${s}" has a space. A protected word must be one word. Put phrases in Entities.`;
    if (!WORD.test(s)) return notAllowed(s);
    return null;
  }
  if (type === 'entity') {
    const parts = s.split(' ');
    if (parts.length < 2)
      return `"${s}" is one word. An entity needs two or more words. Put single words in Protected words.`;
    const bad = parts.find((p) => !WORD.test(p));
    return bad ? notAllowed(bad) : null;
  }
  const sides = s.split('=>');
  if (sides.length > 2) return 'Use "=>" only once in a rule.';
  if (sides.length === 2 && (!sides[0].trim() || !sides[1].trim()))
    return 'Put words on both sides of "=>", for example: tv => television';
  let terms: string[] = [];
  for (const side of sides) {
    const t = side.split(',').map(normalise);
    if (t.some((x) => !x)) return 'There is an empty word between commas. Remove the extra comma.';
    terms = terms.concat(t);
  }
  if (sides.length === 1 && terms.length < 2)
    return `"${s}" has only one word. Write two or more words with commas, for example: couch, sofa`;
  return null;
}

export function parseList(type: Exclude<ListType, 'hunspell'>, text: string): ParseResult {
  const res: ParseResult = { errors: [], warnings: [], entries: [] };
  const seen = new Map<string, number>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.trim();
    if (!s || s.startsWith('#')) return;
    const line = normaliseFor(type, s);
    const err = checkLine(type, line);
    if (err) {
      res.errors.push({ line: i + 1, msg: err });
      return;
    }
    const first = seen.get(line);
    if (first) {
      res.warnings.push({ line: i + 1, msg: `"${line}" is already on line ${first}. Kept once.` });
      return;
    }
    seen.set(line, i + 1);
    res.entries.push(line);
  });
  if (!res.errors.length && !res.entries.length)
    res.errors.push({ line: 0, msg: 'The file has no entries. Lines that start with # are comments.' });
  return res;
}

function baseName(n: string): string {
  return n.replace(/\.[^.]+$/, '');
}

export function parseHunspell(files: TextFile[]): ParseResult {
  const res: ParseResult = { errors: [], warnings: [], entries: [] };
  const affs = files.filter((f) => /\.aff$/i.test(f.name));
  const dics = files.filter((f) => /\.dic$/i.test(f.name));
  if (files.length !== 2 || affs.length !== 1 || dics.length !== 1) {
    res.errors.push({
      line: 0,
      msg: 'Choose two files together: one .aff and one .dic, for example en_US.aff and en_US.dic.',
    });
    return res;
  }
  const [aff, dic] = [affs[0], dics[0]];
  if (baseName(aff.name) !== baseName(dic.name))
    res.errors.push({
      line: 0,
      msg: `The names do not match: ${aff.name} and ${dic.name}. Use two files for the same language.`,
    });
  if (!/^\s*(SET|SFX|PFX)\s/m.test(aff.text))
    res.errors.push({ line: 0, msg: `${aff.name} has no SET, PFX or SFX lines. Is it a Hunspell .aff file?` });

  const lines = dic.text.split(/\r?\n/);
  const first = lines[0].trim();
  if (!/^\d+$/.test(first)) {
    res.errors.push({
      line: 0,
      msg: `${dic.name}, line 1: the first line must be the number of words, for example 49000.`,
    });
    return res;
  }
  for (const l of lines.slice(1)) {
    const w = l.trim().split('/')[0];
    if (w) res.entries.push(w);
  }
  if (!res.entries.length) res.errors.push({ line: 0, msg: `${dic.name} has no words after line 1.` });
  else if (Number(first) !== res.entries.length)
    res.warnings.push({
      line: 0,
      msg: `${dic.name} says ${first} words on line 1, but has ${res.entries.length}. Saved anyway.`,
    });
  res.name = baseName(dic.name);
  return res;
}
