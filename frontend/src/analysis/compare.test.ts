import { describe, expect, it } from 'vitest';
import { NOTHING_LEFT, compareTokens, countFound, plainChain, reasonFor, type Fix } from './compare';
import { readDefinition, resolveAnalyzer } from './definition';
import type { Chain, Token } from './types';

// Tokens as the cluster would send them: "run shoe@1" means two tokens, the second at position 1.
function toks(spec: string): Token[] {
  return spec
    .split(' ')
    .filter(Boolean)
    .map((s, i) => {
      const [token, pos] = s.split('@');
      return { token, start_offset: 0, end_offset: 0, type: 'word', position: pos === undefined ? i : Number(pos) };
    });
}

describe('compareTokens (R3.5)', () => {
  it('is found when every typed word is saved, whatever the mode', () => {
    for (const mode of ['any', 'all'] as const) {
      expect(compareTokens(toks('run shoe men'), toks('shoe'), mode)).toMatchObject({ result: 'found', found: ['shoe'], missing: [] });
    }
  });

  it('is partly found with "any word" and not found with "all words"', () => {
    const saved = toks('run shoe');
    const typed = toks('shoe boot');
    expect(compareTokens(saved, typed, 'any')).toMatchObject({ result: 'partly', found: ['shoe'], missing: ['boot'], words: 2, foundWords: 1 });
    expect(compareTokens(saved, typed, 'all').result).toBe('not_found');
  });

  it('is not found when no typed word is saved', () => {
    expect(compareTokens(toks('run shoe'), toks('boot sock'), 'any')).toMatchObject({ result: 'not_found', foundWords: 0 });
  });

  it('counts tokens at the same position (synonyms) as one word', () => {
    // typed "trainers": the browser makes trainer and sneaker at position 0. One of them is saved.
    const typed = toks('trainer@0 sneaker@0');
    expect(compareTokens(toks('sneaker kid'), typed, 'all')).toMatchObject({ result: 'found', words: 1, foundWords: 1, missing: ['trainer'] });
    // two words, one of them with a synonym
    expect(compareTokens(toks('sneaker'), toks('trainer@0 sneaker@0 red@1'), 'all').result).toBe('not_found');
    expect(compareTokens(toks('sneaker'), toks('trainer@0 sneaker@0 red@1'), 'any').result).toBe('partly');
  });

  it('says which typed words were not found, with the tokens at their position', () => {
    // "trainers red": the word at position 0 has a synonym, only "red" is missing from the saved text
    const r = compareTokens(toks('sneaker kid'), toks('trainer@0 sneaker@0 red@1'), 'any');
    expect(r.unfound).toEqual([['red']]);
    expect(compareTokens(toks('a'), toks('x y@0 z'), 'any').unfound).toEqual([['x', 'y'], ['z']]);
    expect(compareTokens(toks('a'), toks('a'), 'any').unfound).toEqual([]);
  });

  it('counts a repeated typed token once', () => {
    expect(compareTokens(toks('shoe'), toks('shoe shoe'), 'all')).toMatchObject({ result: 'found', words: 1 });
  });

  it('says nothing is left when the typed text has no tokens', () => {
    expect(compareTokens(toks('run shoe'), [], 'any')).toMatchObject({ result: 'nothing_left', words: 0 });
    expect(NOTHING_LEFT.text).toMatch(/nothing left to search for/);
  });
});

describe('reasonFor (R3.9): one reason for each kind of miss', () => {
  const cases: [string, string, string, Fix][] = [
    ['big and small letters', 'IPHONE', 'iPhone pro', 'lowercase'],
    ['accents', 'cafe', 'café creme', 'asciifolding'],
    ['joined or split words', 'wifi', 'wi fi router', 'word_delimiter_graph'],
    ['word forms (same start)', 'shoe', 'shoes men', 'stemmer'],
    ['word forms (longer typed word)', 'shoes', 'shoe men', 'stemmer'],
    ['the start of a word', 'sho', 'shoes men', 'edge_ngram'],
    ['the middle of a word', 'melon', 'watermelon', 'ngram'],
    ['a typo', 'keybord', 'keyboard mechanical', 'fuzziness'],
    ['symbols', 'at&t', 'att prepaid', 'word_delimiter_graph'],
    ['no similar word', 'trainers', 'sneakers kids', 'synonym'],
  ];
  it.each(cases)('%s', (_name, typed, saved, fix) => {
    const r = reasonFor(typed, toks(saved));
    expect(r.fix).toBe(fix);
    expect(r.text).toContain(`"${typed}"`);
  });

  it('names the filter or setting that helps', () => {
    expect(reasonFor('IPHONE', toks('iPhone')).text).toBe('"IPHONE" and "iPhone" differ only in big and small letters. Add the lowercase filter.');
    expect(reasonFor('wifi', toks('wi fi')).text).toContain('word_delimiter_graph with catenate_all');
    expect(reasonFor('keybord', toks('keyboard')).text).toContain('"fuzziness": "AUTO"');
  });
});

describe('plainChain (R2.2)', () => {
  const c = (name: string, analysis: Record<string, unknown>) => resolveAnalyzer(name, analysis) as Chain;

  it('lists the steps in one sentence', () => {
    expect(plainChain(c('english', {}))).toBe("Cut into words, then 's removed, then small letters, then little words removed, then cut to the root.");
    expect(plainChain(c('whitespace', {}))).toBe('Cut at spaces.');
    expect(plainChain(c('simple', {}))).toBe('Cut at non-letters, small letters.');
  });

  it('describes a custom analyzer with all three kinds of steps', () => {
    const analysis = {
      analyzer: { a: { type: 'custom', char_filter: ['html_strip'], tokenizer: 'whitespace', filter: ['word_delimiter_graph', 'lowercase', 'asciifolding', 'synonym_graph'] } },
    };
    expect(plainChain(c('a', analysis))).toBe('HTML removed, then cut at spaces, then split at hyphens, then small letters, then accents removed, then synonyms added.');
  });

  it('uses the step type for a step it has no sentence for', () => {
    expect(plainChain(c('a', { analyzer: { a: { type: 'custom', tokenizer: 'standard', filter: ['cjk_width'] } } }))).toBe('Cut into words, then cjk_width.');
  });
});

describe('countFound', () => {
  it('counts the tests that one field finds', () => {
    const r = readDefinition(JSON.stringify({ mappings: { properties: { t: { type: 'text' } } } }));
    if (!r.ok) throw new Error('bad');
    const cases: [string, string][] = [['Running Shoes', 'shoes'], ['Running Shoes', 'shoe']];
    expect(countFound(r.definition, 't', 'any', cases)).toBe(1);
    expect(() => countFound(r.definition, 'nope', 'any', cases)).toThrow('no field nope');
  });
});
