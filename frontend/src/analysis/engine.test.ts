import { describe, expect, it } from 'vitest';
import { analyzeInBrowser, describeStep, finalTokens, fold, isKnown, notesFor, stem } from './engine';
import type { Chain, Step, StepDef } from './types';

const step = (name: string, def?: Partial<StepDef>): Step => ({ name, def: { type: name, ...def } as StepDef, known: true });

function chain(tokenizer: Step, filters: Step[] = [], charFilters: Step[] = []): Chain {
  return { name: 'test', charFilters, tokenizer, filters };
}

// Final tokens as "token@position", which is easy to read in a failing test.
function run(c: Chain, text: string): string[] {
  return finalTokens(analyzeInBrowser(c, text)).map((t) => `${t.token}@${t.position}`);
}
const words = (c: Chain, text: string) => finalTokens(analyzeInBrowser(c, text)).map((t) => t.token);

describe('tokenizers', () => {
  it('standard cuts at spaces and punctuation, and keeps numbers with a dot', () => {
    expect(words(chain(step('standard')), 'Running Shoes! $19.99 AT&T')).toEqual(['Running', 'Shoes', '19.99', 'AT', 'T']);
    const toks = finalTokens(analyzeInBrowser(chain(step('standard')), 'Size 42'));
    expect(toks.map((t) => t.type)).toEqual(['<ALPHANUM>', '<NUM>']);
    expect(toks[1]).toMatchObject({ start_offset: 5, end_offset: 7, position: 1 });
  });

  it('whitespace keeps punctuation inside words', () => {
    expect(words(chain(step('whitespace')), 'Wi-Fi  Router!')).toEqual(['Wi-Fi', 'Router!']);
  });

  it('letter and lowercase cut at anything that is not a letter', () => {
    expect(words(chain(step('letter')), 'C++ 4K Monitor')).toEqual(['C', 'K', 'Monitor']);
    expect(words(chain(step('lowercase')), 'C++ 4K Monitor')).toEqual(['c', 'k', 'monitor']);
  });

  it('keyword keeps the whole text, and nothing for empty text', () => {
    expect(words(chain(step('keyword')), 'Nike Air Max')).toEqual(['Nike Air Max']);
    expect(words(chain(step('keyword')), '')).toEqual([]);
  });

  it('pattern cuts at non-word characters, or at a given pattern', () => {
    expect(words(chain(step('pattern')), 'red,blue green')).toEqual(['red', 'blue', 'green']);
    expect(words(chain(step('pattern', { pattern: ',' })), 'red,blue green')).toEqual(['red', 'blue green']);
  });

  it('edge_ngram and ngram tokenizers cut words into pieces', () => {
    expect(words(chain(step('edge_ngram', { min_gram: 2, max_gram: 3, token_chars: ['letter'] })), 'run shoe')).toEqual(['ru', 'run', 'sh', 'sho']);
    expect(words(chain(step('ngram', { min_gram: 2, max_gram: 2, token_chars: ['letter'] })), 'cat')).toEqual(['ca', 'at']);
  });
});

describe('character filters', () => {
  it('html_strip removes tags', () => {
    const resp = analyzeInBrowser(chain(step('keyword'), [], [step('html_strip')]), '<b>Nike</b>');
    expect(resp.detail.charfilters[0]).toEqual({ name: 'html_strip', filtered_text: [' Nike '] });
  });

  it('mapping swaps text, pattern_replace changes matches', () => {
    expect(words(chain(step('whitespace'), [], [step('mapping', { mappings: ['& => and', 'broken line'] })]), 'H&M')).toEqual(['HandM']);
    expect(words(chain(step('keyword'), [], [step('pattern_replace', { pattern: '\\d', replacement: '#' })]), 'A12')).toEqual(['A##']);
  });
});

describe('token filters', () => {
  const ws = step('whitespace');

  it('lowercase, uppercase and asciifolding', () => {
    expect(words(chain(ws, [step('lowercase')]), 'IPHONE Pro')).toEqual(['iphone', 'pro']);
    expect(words(chain(ws, [step('uppercase')]), 'nike')).toEqual(['NIKE']);
    expect(words(chain(ws, [step('asciifolding')]), 'Café Straße Smørrebrød')).toEqual(['Cafe', 'Strasse', 'Smorrebrod']);
    expect(fold('São')).toBe('Sao');
  });

  it('stop removes English stop words, a given list, or none', () => {
    expect(run(chain(ws, [step('stop')]), 'the lord of the rings')).toEqual(['lord@1', 'rings@4']);
    expect(words(chain(ws, [step('stop', { stopwords: ['Lord'], ignore_case: true })]), 'the lord')).toEqual(['the']);
    expect(words(chain(ws, [step('stop', { stopwords: '_none_' })]), 'the lord')).toEqual(['the', 'lord']);
  });

  it('stemmer cuts English words to the root', () => {
    expect(words(chain(ws, [step('stemmer', { language: 'english' })]), 'running shoes batteries battery matches ran')).toEqual([
      'run', 'shoe', 'batteri', 'batteri', 'match', 'ran',
    ]);
    expect(words(chain(ws, [step('stemmer', { language: 'light_english' })]), 'batteries running')).toEqual(['battery', 'running']);
    expect(words(chain(ws, [step('stemmer', { language: 'possessive_english' })]), "women's")).toEqual(['women']);
    expect(words(chain(ws, [step('porter_stem')]), 'cooking')).toEqual(['cook']);
    expect(stem('go')).toBe('go');
  });

  it('keyword_marker protects words from the stemmer and marks them', () => {
    const c = chain(ws, [step('keyword_marker', { keywords: ['running'] }), step('stemmer')]);
    const toks = finalTokens(analyzeInBrowser(c, 'running shoes'));
    expect(toks.map((t) => t.token)).toEqual(['running', 'shoe']);
    expect(toks[0].keyword).toBe(true);
    expect(toks[1].keyword).toBeUndefined();
  });

  it('synonym adds words at the same position, or replaces them', () => {
    const same = chain(ws, [step('synonym', { synonyms: ['sneakers, trainers', '# a comment', 'mobile, cell phone'] })]);
    expect(run(same, 'sneakers for kids')).toEqual(['sneakers@0', 'trainers@0', 'for@1', 'kids@2']);
    expect(run(same, 'cell phone case')).toEqual(['cell@0', 'phone@1', 'mobile@0', 'case@2']);
    const toks = finalTokens(analyzeInBrowser(same, 'sneakers'));
    expect(toks[1].type).toBe('SYNONYM');
    const replace = chain(ws, [step('synonym_graph', { synonyms: ['tv => television'] })]);
    expect(run(replace, 'tv stand')).toEqual(['television@0', 'stand@1']);
  });

  it('word_delimiter_graph splits, keeps the original and glues parts', () => {
    expect(run(chain(ws, [step('word_delimiter_graph')]), 'Wi-Fi PowerShot 500ml')).toEqual(['Wi@0', 'Fi@1', 'Power@2', 'Shot@3', '500@4', 'ml@5']);
    const all = chain(ws, [step('word_delimiter_graph', { preserve_original: true, catenate_all: true, split_on_case_change: false })]);
    expect(run(all, 'Wi-Fi Router')).toEqual(['Wi-Fi@0', 'Wi@0', 'WiFi@0', 'Fi@1', 'Router@2']);
    expect(words(chain(ws, [step('word_delimiter', { catenate_words: true })]), 'e-mail')).toEqual(['e', 'email', 'mail']);
    expect(words(chain(ws, [step('word_delimiter_graph')]), "Levi's")).toEqual(['Levi']);
    expect(words(chain(ws, [step('word_delimiter_graph', { protected_words: ['C++'] })]), 'C++')).toEqual(['C++']);
  });

  it('edge_ngram and ngram filters', () => {
    expect(words(chain(ws, [step('edge_ngram', { min_gram: 2, max_gram: 4 })]), 'shoes')).toEqual(['sh', 'sho', 'shoe']);
    expect(words(chain(ws, [step('edge_ngram', { min_gram: 2, max_gram: 3, preserve_original: true })]), 'shoes')).toEqual(['sh', 'sho', 'shoes']);
    expect(words(chain(ws, [step('ngram', { min_gram: 3, max_gram: 3 })]), 'melon')).toEqual(['mel', 'elo', 'lon']);
  });

  it('shingle, trim, reverse, unique, length, truncate', () => {
    expect(words(chain(ws, [step('shingle')]), 'red running shoes')).toEqual(['red', 'red running', 'running', 'running shoes', 'shoes']);
    expect(words(chain(step('keyword'), [step('trim')]), '  nike  ')).toEqual(['nike']);
    expect(words(chain(ws, [step('reverse')]), 'abc')).toEqual(['cba']);
    expect(words(chain(ws, [step('unique')]), 'red red shoe')).toEqual(['red', 'shoe']);
    expect(words(chain(ws, [step('length', { min: 3 })]), 'a tv bag')).toEqual(['bag']);
    expect(words(chain(ws, [step('truncate', { length: 3 })]), 'running')).toEqual(['run']);
  });

  it('apostrophe, elision and pattern_replace', () => {
    expect(words(chain(ws, [step('apostrophe')]), "Levi's")).toEqual(['Levi']);
    expect(words(chain(ws, [step('elision')]), "l'avion")).toEqual(['avion']);
    expect(words(chain(ws, [step('pattern_replace', { pattern: '-', replacement: '' })]), 'wi-fi')).toEqual(['wifi']);
  });
});

describe('the "Online shop" title chain from the prototype', () => {
  const shop: Chain = {
    name: 'shop_text',
    charFilters: [step('html_strip'), { name: 'symbols', def: { type: 'mapping', mappings: ['& => and', '++ => plusplus', '# => sharp'] }, known: true }],
    tokenizer: step('whitespace'),
    filters: [
      { name: 'shop_parts', def: { type: 'word_delimiter_graph', preserve_original: true, catenate_all: true, split_on_case_change: false }, known: true },
      step('lowercase'),
      step('asciifolding'),
      { name: 'shop_synonyms', def: { type: 'synonym_graph', synonyms: ['sneakers, trainers', 'mobile, cell phone'] }, known: true },
      { name: 'protected', def: { type: 'keyword_marker', keywords: ['iphone'] }, known: true },
      { name: 'english_stemmer', def: { type: 'stemmer', language: 'english' }, known: true },
    ],
  };

  it('gives the same tokens as the prototype', () => {
    expect(run(shop, 'Wi-Fi Router')).toEqual(['wi-fi@0', 'wi@0', 'wifi@0', 'fi@1', 'router@2']);
    expect(run(shop, 'Café Crème')).toEqual(['cafe@0', 'creme@1']);
    expect(run(shop, 'Sneakers for kids')).toEqual(['sneaker@0', 'trainer@0', 'for@1', 'kid@2']);
    expect(run(shop, 'AT&T Prepaid')).toEqual(['atandt@0', 'prepaid@1']);
    expect(words(shop, 'iPhone 15 Pro')).toEqual(['iphone', '15', 'pro']);
  });

  it('has the raw _analyze explain shape, one entry per step', () => {
    const resp = analyzeInBrowser(shop, '<b>H&M</b> Hoodie');
    expect(resp.detail.custom_analyzer).toBe(true);
    expect(resp.detail.charfilters.map((c) => c.name)).toEqual(['html_strip', 'symbols']);
    expect(resp.detail.charfilters[1].filtered_text).toEqual([' HandM  Hoodie']);
    expect(resp.detail.tokenizer.name).toBe('whitespace');
    expect(resp.detail.tokenizer.tokens[0]).toEqual({ token: 'HandM', start_offset: 1, end_offset: 6, type: 'word', position: 0 });
    expect(resp.detail.tokenfilters.map((f) => f.name)).toEqual(shop.filters.map((f) => f.name));
    expect(notesFor(shop)).toEqual([]);
  });
});

describe('steps the browser copy does not know (R7.3)', () => {
  it('passes tokens through unchanged and adds a note for each one', () => {
    const c: Chain = {
      name: 'odd',
      charFilters: [{ name: 'kuromoji_iteration_mark', def: { type: 'kuromoji_iteration_mark' }, known: false }],
      tokenizer: { name: 'icu', def: { type: 'icu_tokenizer' }, known: false },
      filters: [step('lowercase'), { name: 'my_hunspell', def: { type: 'hunspell', locale: 'en_US' }, known: false }],
      note: 'The "french" analyzer is simplified here.',
    };
    expect(words(c, 'Running Shoes')).toEqual(['running', 'shoes']);
    const resp = analyzeInBrowser(c, 'Running Shoes');
    expect(resp.detail.tokenfilters[1]).toEqual({ name: 'my_hunspell', tokens: resp.detail.tokenfilters[0].tokens });
    expect(notesFor(c)).toEqual([
      'Character filter "kuromoji_iteration_mark" is not copied in this page; the text was passed through unchanged.',
      'Tokenizer "icu" is not copied in this page; the standard tokenizer was used.',
      'Token filter "my_hunspell" (hunspell) is not copied in this page; tokens were passed through unchanged.',
      'The "french" analyzer is simplified here.',
    ]);
  });

  it('says in describeStep which steps are copied', () => {
    expect(isKnown('filter', 'stemmer')).toBe(true);
    expect(isKnown('filter', 'hunspell')).toBe(false);
    expect(isKnown('filter', 'toString')).toBe(false);
    expect(describeStep('filter', 'lowercase')).toMatch(/small/);
    expect(describeStep('tokenizer', 'icu_tokenizer')).toBe('Not copied in this page. A real cluster runs it.');
  });
});

describe('finalTokens', () => {
  it('uses the tokenizer when there are no filters', () => {
    expect(words(chain(step('whitespace')), 'a b')).toEqual(['a', 'b']);
  });
});
