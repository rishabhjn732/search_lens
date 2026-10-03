import { describe, expect, it } from 'vitest';
import { checkLine, parseHunspell, parseList } from './rules';
// Copies of prototypes/home/samples/, the files the user tested in the prototype.
import badEntity from './fixtures/bad-entity.txt?raw';
import badProtected from './fixtures/bad-protected.txt?raw';
import badSynonyms from './fixtures/bad-synonyms.txt?raw';
import enGbAff from './fixtures/en_GB.aff?raw';
import enGbDic from './fixtures/en_GB.dic?raw';
import goodEntity from './fixtures/good-entity.txt?raw';
import goodSynonyms from './fixtures/good-synonyms.txt?raw';

const SAMPLES: Record<string, string> = {
  'bad-entity.txt': badEntity,
  'bad-protected.txt': badProtected,
  'bad-synonyms.txt': badSynonyms,
  'en_GB.aff': enGbAff,
  'en_GB.dic': enGbDic,
  'good-entity.txt': goodEntity,
  'good-synonyms.txt': goodSynonyms,
};
const sample = (name: string) => SAMPLES[name];

describe('checkLine', () => {
  it('entity: needs two or more words', () => {
    expect(checkLine('entity', 'ai supplychain')).toBeNull();
    expect(checkLine('entity', 'ai')).toBe(
      '"ai" is one word. An entity needs two or more words. Put single words in Protected words.',
    );
  });

  it('entity and protected: only letters, numbers and - _ . \'', () => {
    expect(checkLine('entity', 'co-op data.lake')).toBeNull();
    expect(checkLine('entity', 'ai supply$chain')).toBe(
      '"supply$chain" has a character that is not allowed. Use letters, numbers, - _ . or \'.',
    );
    expect(checkLine('protected', 'wi*fi')).toBe(
      '"wi*fi" has a character that is not allowed. Use letters, numbers, - _ . or \'.',
    );
  });

  it('protected: one word only', () => {
    expect(checkLine('protected', 'iphone')).toBeNull();
    expect(checkLine('protected', 'running shoes')).toBe(
      '"running shoes" has a space. A protected word must be one word. Put phrases in Entities.',
    );
  });

  it('synonym: the four kinds of mistakes', () => {
    expect(checkLine('synonym', 'sneakers, running shoes')).toBeNull();
    expect(checkLine('synonym', 'tv => television')).toBeNull();
    expect(checkLine('synonym', 'x => y => z')).toBe('Use "=>" only once in a rule.');
    expect(checkLine('synonym', 'tv =>')).toBe('Put words on both sides of "=>", for example: tv => television');
    expect(checkLine('synonym', 'couch, , sofa')).toBe('There is an empty word between commas. Remove the extra comma.');
    expect(checkLine('synonym', 'sofa')).toBe(
      '"sofa" has only one word. Write two or more words with commas, for example: couch, sofa',
    );
  });
});

describe('parseList', () => {
  it('skips comments and empty lines, lower-cases, and keeps duplicates once with a warning', () => {
    const res = parseList('entity', '# comment\n\nAI  SupplyChain\nnew york\nai supplychain\n');

    expect(res.errors).toEqual([]);
    expect(res.entries).toEqual(['ai supplychain', 'new york']);
    expect(res.warnings).toEqual([{ line: 5, msg: '"ai supplychain" is already on line 3. Kept once.' }]);
  });

  it('gives each problem with its line number', () => {
    const res = parseList('synonym', 'sneakers, running shoes\ntv =>\na,,b\nsofa\nx => y => z\n');

    expect(res.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
  });

  it('says when no entries are left', () => {
    expect(parseList('protected', '# only comments\n\n').errors).toEqual([
      { line: 0, msg: 'The file has no entries. Lines that start with # are comments.' },
    ]);
  });

  it('normalises synonym spacing', () => {
    expect(parseList('synonym', 'Sneakers ,Running   Shoes').entries).toEqual(['sneakers, running shoes']);
  });

  it('reads the sample files the user tested in the prototype', () => {
    const good = parseList('entity', sample('good-entity.txt'));
    expect(good.errors).toEqual([]);
    expect(good.entries).toHaveLength(3);
    expect(good.warnings).toHaveLength(1);

    expect(parseList('entity', sample('bad-entity.txt')).errors.map((e) => e.line)).toEqual([3]);
    expect(parseList('protected', sample('bad-protected.txt')).errors.map((e) => e.line)).toEqual([3]);
    expect(parseList('synonym', sample('bad-synonyms.txt')).errors).toHaveLength(3);
    expect(parseList('synonym', sample('good-synonyms.txt')).entries).toHaveLength(2);
  });
});

describe('parseHunspell', () => {
  const aff = (name: string, text = 'SET UTF-8\nSFX S Y 1\n') => ({ name, text });
  const dic = (name: string, text: string) => ({ name, text });

  it('reads the words of a matching .aff and .dic pair', () => {
    const res = parseHunspell([
      { name: 'en_GB.aff', text: sample('en_GB.aff') },
      { name: 'en_GB.dic', text: sample('en_GB.dic') },
    ]);

    expect(res.errors).toEqual([]);
    expect(res.name).toBe('en_GB');
    expect(res.entries).toEqual(['run', 'shoe', 'walk']);
  });

  it('needs exactly one .aff and one .dic', () => {
    expect(parseHunspell([aff('en_US.aff')]).errors[0].msg).toBe(
      'Choose two files together: one .aff and one .dic, for example en_US.aff and en_US.dic.',
    );
  });

  it('checks names, the .aff content and line 1 of the .dic', () => {
    const res = parseHunspell([aff('en_US.aff', 'hello\n'), dic('de_DE.dic', 'x\nrun\n')]);

    expect(res.errors.map((e) => e.msg)).toEqual([
      'The names do not match: en_US.aff and de_DE.dic. Use two files for the same language.',
      'en_US.aff has no SET, PFX or SFX lines. Is it a Hunspell .aff file?',
      'de_DE.dic, line 1: the first line must be the number of words, for example 49000.',
    ]);
  });

  it('warns but saves when the word count on line 1 is different', () => {
    const res = parseHunspell([aff('en_US.aff'), dic('en_US.dic', '3\nrun/S\nwalk\n')]);

    expect(res.errors).toEqual([]);
    expect(res.entries).toEqual(['run', 'walk']);
    expect(res.warnings[0].msg).toBe('en_US.dic says 3 words on line 1, but has 2. Saved anyway.');
  });

  it('refuses a .dic with no words', () => {
    expect(parseHunspell([aff('en_US.aff'), dic('en_US.dic', '0\n')]).errors[0].msg).toBe(
      'en_US.dic has no words after line 1.',
    );
  });
});
