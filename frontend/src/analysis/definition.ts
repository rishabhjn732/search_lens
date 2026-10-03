// Reading a pasted index definition (spec 007): its fields, the steps of each field, the things
// to check before creating it, and the body to create it. No network.
// Ported from prototypes/lab/analyzer.js.
import { isKnown, type StepKind } from './engine';
import type { Chain, Field, Step, StepDef } from './types';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown): Json => (isObj(v) ? v : {});

export interface Definition {
  name?: string;
  mappings: Json & { properties: Json };
  settings: Json;
  analysis: Json;
}

export interface ReadError {
  line?: number;
  col?: number;
  message: string;
}

export type ReadResult = { ok: true; definition: Definition } | { ok: false; error: ReadError };

export const NO_PROPERTIES =
  'No "mappings.properties" found. Paste the body you would send to PUT /<index>, or the answer of GET /<index>.';

// ---- JSON mistakes in plain words (R1.3) -------------------------------------
// Browsers do not say where JSON breaks, so a small scanner finds the place.

class JsonMistake {
  constructor(
    public at: number,
    public message: string,
  ) {}
}

function findJsonMistake(text: string): JsonMistake | null {
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const fail = (message: string): never => {
    throw new JsonMistake(i, message);
  };
  const str = () => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\n') fail('A text in quotes cannot go over two lines. Is a " missing?');
      if (text[i] === '\\') i++;
      i++;
    }
    if (i >= text.length) fail('A double quote (") is missing at the end of a text.');
    i++;
  };
  const value = (): void => {
    ws();
    const ch = text[i];
    if (ch === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] === "'") fail('Use double quotes ("), not single quotes.');
        if (text[i] !== '"') fail('Expected a name in double quotes, like "title".');
        str();
        ws();
        if (text[i] !== ':') fail('Expected a colon (:) after the name.');
        i++;
        value();
        ws();
        if (text[i] === ',') {
          i++;
          ws();
          if (text[i] === '}') fail('Remove the comma before }.');
          continue;
        }
        if (text[i] === '}') {
          i++;
          return;
        }
        if (i >= text.length) fail('The text ends too early. Is a } missing?');
        fail('Expected a comma (,) or a closing brace (}).');
      }
    }
    if (ch === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ',') {
          i++;
          ws();
          if (text[i] === ']') fail('Remove the comma before ].');
          continue;
        }
        if (text[i] === ']') {
          i++;
          return;
        }
        if (i >= text.length) fail('The text ends too early. Is a ] missing?');
        fail('Expected a comma (,) or a closing bracket (]).');
      }
    }
    if (ch === '"') return str();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (m) {
      i += m[0].length;
      return;
    }
    if (ch === "'") fail('Use double quotes ("), not single quotes.');
    if (ch === undefined) fail('The text ends too early. Is a } or ] missing?');
    fail(`Unexpected "${ch}" here.`);
  };
  try {
    value();
    ws();
    if (i < text.length) fail('There is extra text after the last }.');
    return null;
  } catch (e) {
    if (e instanceof JsonMistake) return e;
    throw e;
  }
}

function jsonError(text: string): ReadError {
  const found = findJsonMistake(text);
  if (!found) return { message: 'This is not valid JSON.' };
  const before = text.slice(0, found.at).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1, message: found.message };
}

// ---- reading (R1.2 to R1.4) ----------------------------------------------------

// Accepts {settings, mappings}, the answer of GET /<index>, and {mappings} alone.
export function readDefinition(text: string): ReadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: jsonError(text) };
  }
  if (!isObj(data)) return { ok: false, error: { message: 'The text must be one JSON object, starting with {.' } };
  let name: string | undefined;
  const keys = Object.keys(data);
  if (keys.length === 1 && isObj(data[keys[0]]) && ('mappings' in obj(data[keys[0]]) || 'settings' in obj(data[keys[0]]))) {
    name = keys[0];
    data = data[keys[0]];
  }
  const body = obj(data);
  const mappings = obj(body.mappings);
  if (!isObj(mappings.properties)) return { ok: false, error: { message: NO_PROPERTIES } };
  const settings = obj(body.settings);
  const analysis = obj(settings.analysis ?? obj(settings.index).analysis);
  return { ok: true, definition: { name, mappings: mappings as Definition['mappings'], settings, analysis } };
}

// ---- built-in names ------------------------------------------------------------
// Names OpenSearch knows without a definition in settings.analysis. A name that is in neither
// place makes OpenSearch refuse the index (R2.6 "problem").

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

const BUILTIN: Record<StepKind, Set<string>> = {
  tokenizer: words(`standard letter lowercase whitespace uax_url_email classic thai keyword pattern simple_pattern
    simple_pattern_split char_group path_hierarchy ngram edge_ngram`),
  char: words('html_strip mapping pattern_replace'),
  filter: words(`apostrophe asciifolding cjk_bigram cjk_width classic common_grams condition decimal_digit
    delimited_payload dictionary_decompounder edge_ngram elision fingerprint flatten_graph hunspell
    hyphenation_decompounder keep keep_types keyword_marker keyword_repeat kstem length limit lowercase
    min_hash multiplexer ngram arabic_normalization german_normalization hindi_normalization
    indic_normalization sorani_normalization persian_normalization scandinavian_normalization
    scandinavian_folding serbian_normalization pattern_capture pattern_replace phonetic porter_stem
    predicate_token_filter remove_duplicates reverse shingle snowball stemmer stemmer_override stop
    synonym synonym_graph trim truncate unique uppercase word_delimiter word_delimiter_graph`),
};

const LANGUAGES = words(`arabic armenian basque bengali brazilian bulgarian catalan cjk czech danish dutch
  estonian finnish french galician german greek hindi hungarian indonesian irish italian latvian
  lithuanian norwegian persian portuguese romanian russian sorani spanish swedish turkish thai`);

function builtinStep(kind: StepKind, name: string, def?: Json): Step {
  const d = { type: name, ...def } as StepDef;
  return { name, def: d, known: isKnown(kind, d.type) };
}

function builtinAnalyzer(type: string, d: Json = {}): Omit<Chain, 'name'> | null {
  const t = (n: string, def?: Json) => builtinStep('tokenizer', n, def);
  const f = (n: string, def?: Json) => builtinStep('filter', n, def);
  const stop = d.stopwords !== undefined && d.stopwords !== '_none_' ? [f('stop', { stopwords: d.stopwords })] : [];
  switch (type) {
    case 'standard':
      return { charFilters: [], tokenizer: t('standard'), filters: [f('lowercase'), ...stop] };
    case 'simple':
      return { charFilters: [], tokenizer: t('lowercase'), filters: [] };
    case 'whitespace':
      return { charFilters: [], tokenizer: t('whitespace'), filters: [] };
    case 'keyword':
      return { charFilters: [], tokenizer: t('keyword'), filters: [] };
    case 'stop':
      return { charFilters: [], tokenizer: t('lowercase'), filters: [f('stop', { stopwords: d.stopwords ?? '_english_' })] };
    case 'pattern':
      return { charFilters: [], tokenizer: t('pattern', { pattern: d.pattern ?? '\\W+' }), filters: [f('lowercase'), ...stop] };
    case 'fingerprint':
      return { charFilters: [], tokenizer: t('standard'), filters: [f('lowercase'), f('asciifolding'), ...stop, f('fingerprint')] };
    case 'english':
      // The documented parts of the built-in english analyzer, so every step can be shown.
      return {
        charFilters: [],
        tokenizer: t('standard'),
        filters: [
          { name: 'english_possessive_stemmer', def: { type: 'stemmer', language: 'possessive_english' }, known: true },
          f('lowercase'),
          { name: 'english_stop', def: { type: 'stop', stopwords: d.stopwords ?? '_english_' }, known: true },
          { name: 'english_stemmer', def: { type: 'stemmer', language: 'english' }, known: true },
        ],
      };
  }
  if (LANGUAGES.has(type)) {
    return {
      charFilters: [],
      tokenizer: t('standard'),
      filters: [f('lowercase')],
      note: `The "${type}" analyzer is simplified here: only standard and lowercase. A real cluster also removes ${type} stop words and stems the words.`,
    };
  }
  return null;
}

function resolveStep(kind: StepKind, ref: unknown, analysis: Json): Step {
  const table = kind === 'tokenizer' ? 'tokenizer' : kind === 'char' ? 'char_filter' : 'filter';
  if (isObj(ref)) {
    const type = String(ref.type ?? '?');
    return { name: `${type} (inline)`, def: { ...ref, type } as StepDef, known: isKnown(kind, type) };
  }
  const name = String(ref);
  const custom = obj(analysis[table])[name];
  if (isObj(custom)) {
    const type = String(custom.type ?? name);
    return { name, def: { ...custom, type } as StepDef, known: isKnown(kind, type) };
  }
  return builtinStep(kind, name);
}

export type ChainResult = Chain | { error: string };

export function resolveAnalyzer(name: string, analysis: Json): ChainResult {
  const def = obj(analysis.analyzer)[name];
  if (!isObj(def)) {
    const b = builtinAnalyzer(name);
    return b
      ? { name, ...b }
      : { error: `The analyzer "${name}" is not defined in settings.analysis and is not a built-in analyzer.` };
  }
  const type = String(def.type ?? 'custom');
  if (type !== 'custom') {
    const b = builtinAnalyzer(type, def);
    return b ? { name, ...b } : { error: `The analyzer "${name}" has the unknown type "${type}".` };
  }
  if (def.tokenizer === undefined) return { error: `The analyzer "${name}" has no tokenizer. Every custom analyzer needs one.` };
  return {
    name,
    charFilters: ([] as unknown[]).concat(def.char_filter ?? []).map((r) => resolveStep('char', r, analysis)),
    tokenizer: resolveStep('tokenizer', def.tokenizer, analysis),
    filters: ([] as unknown[]).concat(def.filter ?? []).map((r) => resolveStep('filter', r, analysis)),
  };
}

export function resolveNormalizer(name: string, analysis: Json): ChainResult {
  const def = obj(analysis.normalizer)[name];
  const keyword = builtinStep('tokenizer', 'keyword');
  if (!isObj(def)) {
    if (name === 'lowercase') return { name, charFilters: [], tokenizer: keyword, filters: [builtinStep('filter', 'lowercase')] };
    return { error: `The normalizer "${name}" is not defined in settings.analysis.normalizer.` };
  }
  return {
    name,
    charFilters: ([] as unknown[]).concat(def.char_filter ?? []).map((r) => resolveStep('char', r, analysis)),
    tokenizer: keyword,
    filters: ([] as unknown[]).concat(def.filter ?? []).map((r) => resolveStep('filter', r, analysis)),
  };
}

export const KEYWORD_CHAIN: Chain = { name: '(saved whole)', charFilters: [], tokenizer: builtinStep('tokenizer', 'keyword'), filters: [] };

// ---- fields (R2.1) -------------------------------------------------------------

const TEXT_TYPES = new Set(['text', 'match_only_text', 'search_as_you_type']);
const KEYWORD_TYPES = new Set(['keyword', 'constant_keyword', 'wildcard']);

function fieldOf(path: string, f: Json, analysis: Json, parent?: string): Field {
  const type = String(f.type ?? 'object');
  const has = (n: string) => n in obj(analysis.analyzer);
  const field: Field = { path, type, kind: 'other' };
  if (parent) field.parent = parent;
  if (TEXT_TYPES.has(type)) {
    const analyzer = typeof f.analyzer === 'string' ? f.analyzer : undefined;
    field.kind = 'text';
    field.indexAnalyzer = analyzer ?? (has('default') ? 'default' : 'standard');
    // Search order: field search_analyzer, index default_search, field analyzer, index default, standard.
    field.searchAnalyzer =
      typeof f.search_analyzer === 'string'
        ? f.search_analyzer
        : has('default_search')
          ? 'default_search'
          : field.indexAnalyzer;
  } else if (KEYWORD_TYPES.has(type)) {
    field.kind = 'keyword';
    if (typeof f.normalizer === 'string') field.normalizer = f.normalizer;
  }
  return field;
}

export function listFields(mappings: Json, analysis: Json): Field[] {
  const out: Field[] = [];
  const walk = (props: Json, prefix: string) => {
    Object.entries(props).forEach(([key, raw]) => {
      const f = obj(raw);
      const path = prefix + key;
      if (isObj(f.properties)) {
        out.push({ path, type: String(f.type ?? 'object'), kind: 'object' });
        walk(f.properties, `${path}.`);
        return;
      }
      out.push(fieldOf(path, f, analysis));
      Object.entries(obj(f.fields)).forEach(([sub, sraw]) => out.push(fieldOf(`${path}.${sub}`, obj(sraw), analysis, path)));
    });
  };
  walk(obj(mappings.properties), '');
  return out;
}

// The steps a field uses when saving ('index') or when searching ('search'). Null for other types.
export function chainFor(field: Field, side: 'index' | 'search', analysis: Json): ChainResult | null {
  if (field.kind === 'text') return resolveAnalyzer((side === 'search' ? field.searchAnalyzer : field.indexAnalyzer) ?? 'standard', analysis);
  if (field.kind === 'keyword') return field.normalizer ? resolveNormalizer(field.normalizer, analysis) : KEYWORD_CHAIN;
  return null;
}

// ---- things to check (R2.6) ------------------------------------------------------

export type CheckLevel = 'problem' | 'warning' | 'tip';

export interface Check {
  level: CheckLevel;
  field?: string;
  message: string;
}

const FILE_SETTINGS = ['synonyms_path', 'keywords_path', 'stopwords_path'];

function stepKind(chain: Chain, s: Step): StepKind {
  return s === chain.tokenizer ? 'tokenizer' : chain.charFilters.includes(s) ? 'char' : 'filter';
}

export function checkDefinition(def: Definition): Check[] {
  const out: Check[] = [];
  const add = (c: Check) => {
    if (!out.some((x) => x.level === c.level && x.field === c.field && x.message === c.message)) out.push(c);
  };
  listFields(def.mappings, def.analysis).forEach((f) => {
    const sides: ('index' | 'search')[] = f.kind === 'text' ? ['index', 'search'] : ['index'];
    sides.forEach((side) => {
      const c = chainFor(f, side, def.analysis);
      if (!c) return;
      if ('error' in c) {
        add({ level: 'problem', field: f.path, message: c.error });
        return;
      }
      [...c.charFilters, c.tokenizer, ...c.filters].forEach((s) => {
        const kind = stepKind(c, s);
        const fromSettings = !s.name.endsWith('(inline)') && s.name !== s.def.type;
        if (!s.known && !fromSettings && !s.name.endsWith('(inline)') && !BUILTIN[kind].has(s.def.type)) {
          add({ level: 'problem', field: f.path, message: `"${s.name}" is not defined in settings.analysis and is not built in. OpenSearch will refuse this index.` });
        } else if (s.def.type === 'hunspell' || FILE_SETTINGS.some((k) => k in s.def)) {
          add({ level: 'warning', field: f.path, message: `"${s.name}" reads a file on the server disk. Search Lens cannot test that file here; paste the words inline to test them.` });
        } else if (!s.known) {
          add({ level: 'warning', field: f.path, message: `"${s.name}" (${s.def.type}) is not copied in this page, so its tokens are passed through unchanged. Connect to a cluster for exact tokens.` });
        }
      });
      if (c.note) add({ level: 'warning', field: f.path, message: c.note });
    });
    if (f.kind === 'keyword' && !f.normalizer && !f.parent) {
      add({ level: 'tip', field: f.path, message: 'Keyword field without a normalizer: "Nike" and "nike" are different values. Add "normalizer": "lowercase" if case should not matter.' });
    }
    if (f.kind === 'text' && f.searchAnalyzer !== f.indexAnalyzer) {
      add({ level: 'tip', field: f.path, message: 'This field uses one analyzer when saving and another when searching. That is fine for autocomplete, but check the test results.' });
    }
  });
  const shards = def.settings.number_of_shards ?? obj(def.settings.index).number_of_shards;
  if (shards === undefined) {
    add({ level: 'tip', message: 'number_of_shards is not set, so OpenSearch uses 1 shard. That is fine for small indexes (under about 30 GB).' });
  }
  return out;
}

// ---- the body that creates the index (R6.2) ------------------------------------------

const SET_BY_OPENSEARCH = ['uuid', 'creation_date', 'version', 'provided_name'];

export function createBody(def: Definition): { settings?: Json; mappings: Json } {
  const settings: Json = JSON.parse(JSON.stringify(def.settings));
  if (isObj(settings.index)) {
    Object.entries(settings.index).forEach(([k, v]) => {
      if (settings[k] === undefined) settings[k] = v;
    });
    delete settings.index;
  }
  SET_BY_OPENSEARCH.forEach((k) => delete settings[k]);
  return Object.keys(settings).length ? { settings, mappings: def.mappings } : { mappings: def.mappings };
}
