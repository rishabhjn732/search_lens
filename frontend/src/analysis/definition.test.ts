import { describe, expect, it } from 'vitest';
import {
  NO_PROPERTIES,
  chainFor,
  checkDefinition,
  createBody,
  listFields,
  readDefinition,
  resolveAnalyzer,
  type Definition,
} from './definition';
import type { Chain } from './types';

function read(json: unknown): Definition {
  const r = readDefinition(typeof json === 'string' ? json : JSON.stringify(json));
  if (!r.ok) throw new Error(r.error.message);
  return r.definition;
}
function errorOf(text: string) {
  const r = readDefinition(text);
  if (r.ok) throw new Error('expected an error');
  return r.error;
}
function chainOf(def: Definition, path: string, side: 'index' | 'search' = 'index'): Chain {
  const f = listFields(def.mappings, def.analysis).find((x) => x.path === path);
  const c = f && chainFor(f, side, def.analysis);
  if (!c || 'error' in c) throw new Error(`no chain for ${path}`);
  return c;
}
const stepNames = (c: Chain) => [...c.charFilters, c.tokenizer, ...c.filters].map((s) => s.name);

const SHOP = {
  settings: {
    number_of_shards: 1,
    analysis: {
      char_filter: { symbols: { type: 'mapping', mappings: ['& => and'] } },
      filter: { english_stemmer: { type: 'stemmer', language: 'english' } },
      analyzer: {
        shop_text: { type: 'custom', char_filter: ['html_strip', 'symbols'], tokenizer: 'whitespace', filter: ['lowercase', 'english_stemmer'] },
        autocomplete_search: { type: 'custom', tokenizer: 'standard', filter: ['lowercase'] },
      },
      normalizer: { lower: { type: 'custom', filter: ['lowercase', 'asciifolding'] } },
    },
  },
  mappings: {
    properties: {
      title: { type: 'text', analyzer: 'shop_text', fields: { suggest: { type: 'text', analyzer: 'standard', search_analyzer: 'autocomplete_search' }, raw: { type: 'keyword' } } },
      brand: { type: 'keyword', normalizer: 'lower' },
      price: { type: 'float' },
      http: { properties: { status: { type: 'integer' }, path: { type: 'keyword' } } },
    },
  },
};

describe('readDefinition: accepted shapes (R1.2)', () => {
  it('reads {settings, mappings}', () => {
    const d = read(SHOP);
    expect(d.name).toBeUndefined();
    expect(Object.keys(d.mappings.properties)).toEqual(['title', 'brand', 'price', 'http']);
    expect(Object.keys(d.analysis.analyzer as object)).toEqual(['shop_text', 'autocomplete_search']);
  });

  it('reads the answer of GET /<index>, with its name and settings.index.analysis', () => {
    const d = read({
      products: {
        aliases: {},
        mappings: { properties: { title: { type: 'text', analyzer: 'my' } } },
        settings: { index: { number_of_shards: '2', uuid: 'abc', analysis: { analyzer: { my: { type: 'custom', tokenizer: 'keyword' } } } } },
      },
    });
    expect(d.name).toBe('products');
    expect(Object.keys(d.analysis.analyzer as object)).toEqual(['my']);
  });

  it('reads {mappings} alone', () => {
    const d = read({ mappings: { properties: { title: { type: 'text' } } } });
    expect(d.settings).toEqual({});
    expect(d.analysis).toEqual({});
  });
});

describe('readDefinition: mistakes (R1.3, R1.4)', () => {
  it('gives line, column and a plain message for JSON mistakes', () => {
    expect(errorOf('{\n  "mappings": {"properties": {}},\n}')).toEqual({ line: 3, col: 1, message: 'Remove the comma before }.' });
    expect(errorOf("{'mappings': {}}")).toEqual({ line: 1, col: 2, message: 'Use double quotes ("), not single quotes.' });
    expect(errorOf('{"mappings": {"properties": {}}')).toMatchObject({ line: 1, message: 'The text ends too early. Is a } missing?' });
    expect(errorOf('{"a": 1 "b": 2}')).toMatchObject({ line: 1, col: 9, message: 'Expected a comma (,) or a closing brace (}).' });
    expect(errorOf('{"a": [1, 2,]}').message).toBe('Remove the comma before ].');
    expect(errorOf('{"a" 1}').message).toBe('Expected a colon (:) after the name.');
    expect(errorOf('{"a": 1} x').message).toBe('There is extra text after the last }.');
  });

  it('asks for one JSON object', () => {
    expect(errorOf('[1, 2]').message).toBe('The text must be one JSON object, starting with {.');
  });

  it('says what to paste when mappings.properties is missing', () => {
    expect(errorOf('{"settings": {}}').message).toBe(NO_PROPERTIES);
    expect(errorOf('{"properties": {"title": {"type": "text"}}}').message).toBe(NO_PROPERTIES);
  });
});

describe('listFields (R2.1)', () => {
  it('lists fields, extra ways to save a field, and fields inside objects with dotted names', () => {
    const d = read(SHOP);
    const fields = listFields(d.mappings, d.analysis);
    expect(fields.map((f) => `${f.path}:${f.kind}`)).toEqual([
      'title:text', 'title.suggest:text', 'title.raw:keyword', 'brand:keyword', 'price:other', 'http:object', 'http.status:other', 'http.path:keyword',
    ]);
    expect(fields[1]).toMatchObject({ parent: 'title', indexAnalyzer: 'standard', searchAnalyzer: 'autocomplete_search' });
    expect(fields[3]).toMatchObject({ normalizer: 'lower' });
  });

  it('finds the search analyzer in the right order', () => {
    const fieldsOf = (analyzers: object, field: object) => {
      const d = read({ settings: { analysis: { analyzer: analyzers } }, mappings: { properties: { f: field } } });
      return listFields(d.mappings, d.analysis)[0];
    };
    const kw = { type: 'custom', tokenizer: 'keyword' };
    expect(fieldsOf({}, { type: 'text' })).toMatchObject({ indexAnalyzer: 'standard', searchAnalyzer: 'standard' });
    expect(fieldsOf({ default: kw }, { type: 'text' })).toMatchObject({ indexAnalyzer: 'default', searchAnalyzer: 'default' });
    expect(fieldsOf({}, { type: 'text', analyzer: 'english' })).toMatchObject({ searchAnalyzer: 'english' });
    expect(fieldsOf({ default_search: kw }, { type: 'text', analyzer: 'english' })).toMatchObject({ searchAnalyzer: 'default_search' });
    expect(fieldsOf({ default_search: kw }, { type: 'text', search_analyzer: 'simple' })).toMatchObject({ searchAnalyzer: 'simple' });
  });
});

describe('chains', () => {
  it('builds custom analyzers from settings, with names from the definition', () => {
    const d = read(SHOP);
    const c = chainOf(d, 'title');
    expect(stepNames(c)).toEqual(['html_strip', 'symbols', 'whitespace', 'lowercase', 'english_stemmer']);
    expect(c.charFilters[1].def).toEqual({ type: 'mapping', mappings: ['& => and'] });
    expect([...c.charFilters, c.tokenizer, ...c.filters].every((s) => s.known)).toBe(true);
    expect(stepNames(chainOf(d, 'title.suggest', 'search'))).toEqual(['standard', 'lowercase']);
  });

  it('sends built-in english as its parts, so every step shows', () => {
    const c = resolveAnalyzer('english', {});
    expect('error' in c).toBe(false);
    expect(stepNames(c as Chain)).toEqual(['standard', 'english_possessive_stemmer', 'lowercase', 'english_stop', 'english_stemmer']);
  });

  it('handles built-in types with settings, language analyzers, inline steps and normalizers', () => {
    const a = { analyzer: { st: { type: 'standard', stopwords: ['the'] }, inl: { tokenizer: { type: 'edge_ngram', max_gram: 5 }, filter: [{ type: 'lowercase' }] } } };
    expect(stepNames(resolveAnalyzer('st', a) as Chain)).toEqual(['standard', 'lowercase', 'stop']);
    expect((resolveAnalyzer('inl', a) as Chain).tokenizer).toEqual({ name: 'edge_ngram (inline)', def: { type: 'edge_ngram', max_gram: 5 }, known: true });
    expect((resolveAnalyzer('french', {}) as Chain).note).toMatch(/simplified/);
    const d = read(SHOP);
    expect(stepNames(chainOf(d, 'brand'))).toEqual(['keyword', 'lowercase', 'asciifolding']);
    expect(stepNames(chainOf(d, 'title.raw'))).toEqual(['keyword']);
    const price = listFields(d.mappings, d.analysis).find((f) => f.path === 'price');
    expect(price && chainFor(price, 'index', d.analysis)).toBeNull();
  });

  it('says when an analyzer, normalizer or tokenizer is missing', () => {
    expect(resolveAnalyzer('nope', {})).toEqual({ error: 'The analyzer "nope" is not defined in settings.analysis and is not a built-in analyzer.' });
    expect(resolveAnalyzer('x', { analyzer: { x: { type: 'custom', filter: ['lowercase'] } } })).toEqual({
      error: 'The analyzer "x" has no tokenizer. Every custom analyzer needs one.',
    });
  });
});

describe('checkDefinition (R2.6)', () => {
  // Each check as "level|field|message"; the tests compare the start of the message.
  const levels = (json: object) => checkDefinition(read(json)).map((c) => `${c.level}|${c.field ?? ''}|${c.message}`);
  const starts = (s: string) => expect.stringMatching(new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

  it('finds problems OpenSearch would refuse', () => {
    const out = levels({
      settings: { number_of_shards: 1, analysis: { analyzer: { a: { type: 'custom', tokenizer: 'standard', filter: ['lowercas'] } }, normalizer: {} } },
      mappings: { properties: { t: { type: 'text', analyzer: 'a' }, u: { type: 'text', analyzer: 'missing' }, k: { type: 'keyword', normalizer: 'nope' } } },
    });
    expect(out).toEqual([
      starts('problem|t|"lowercas" is not defined in settings.anal'),
      starts('problem|u|The analyzer "missing" is not defined in '),
      starts('problem|k|The normalizer "nope" is not defined in s'),
    ]);
  });

  it('warns about files on the server and steps this page does not copy', () => {
    const out = levels({
      settings: {
        number_of_shards: 1,
        analysis: {
          filter: { syn: { type: 'synonym', synonyms_path: 'analysis/syn.txt' }, hs: { type: 'hunspell', locale: 'en_US' } },
          analyzer: { a: { type: 'custom', tokenizer: 'standard', filter: ['syn', 'hs', 'cjk_width'] } },
        },
      },
      mappings: { properties: { t: { type: 'text', analyzer: 'a' }, f: { type: 'text', analyzer: 'french' } } },
    });
    expect(out).toEqual([
      starts('warning|t|"syn" reads a file on the server disk. Se'),
      starts('warning|t|"hs" reads a file on the server disk. Sea'),
      starts('warning|t|"cjk_width" (cjk_width) is not copied in'),
      starts('warning|f|The "french" analyzer is simplified here'),
    ]);
  });

  it('gives tips, once each', () => {
    const out = levels({
      mappings: { properties: { brand: { type: 'keyword' }, t: { type: 'text', fields: { kw: { type: 'keyword' } }, search_analyzer: 'simple' } } },
    });
    expect(out).toEqual([
      starts('tip|brand|Keyword field without a normalizer: "Nik'),
      starts('tip|t|This field uses one analyzer when saving'),
      starts('tip||number_of_shards is not set, so OpenSea'),
    ]);
  });

  it('has nothing to say about a clean definition', () => {
    expect(checkDefinition(read({ settings: { index: { number_of_shards: '1' } }, mappings: { properties: { t: { type: 'text' } } } }))).toEqual([]);
  });
});

describe('createBody (R6.2)', () => {
  it('flattens settings.index and removes what OpenSearch sets by itself', () => {
    const d = read({
      products: {
        mappings: { properties: { t: { type: 'text' } } },
        settings: { index: { number_of_shards: '2', uuid: 'u', creation_date: '1', version: { created: '1' }, provided_name: 'products', analysis: { analyzer: {} } } },
      },
    });
    expect(createBody(d)).toEqual({ settings: { number_of_shards: '2', analysis: { analyzer: {} } }, mappings: { properties: { t: { type: 'text' } } } });
    expect(d.settings.index).toBeDefined();
  });

  it('leaves out empty settings', () => {
    expect(createBody(read({ mappings: { properties: {} } }))).toEqual({ mappings: { properties: {} } });
  });
});
