import { describe, expect, it } from 'vitest';
import { bestFieldFinds, compareTokens, countFound } from './compare';
import { chainFor, listFields, readDefinition, type Definition } from './definition';
import { analyzeInBrowser, finalTokens } from './engine';
import { EXAMPLES, LESSONS } from './tests';

const ALL: [string, string][] = LESSONS.flatMap((l) => l.cases);

function read(body: unknown): Definition {
  const r = readDefinition(JSON.stringify(body));
  if (!r.ok) throw new Error(r.error.message);
  return r.definition;
}
const example = (id: string) => {
  const e = EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`no example ${id}`);
  return read(e.body);
};

describe('the 100 tests (R3.1)', () => {
  it('has 10 lessons of 10 tests, in the order of the requirements', () => {
    expect(LESSONS.map((l) => l.name)).toEqual([
      'Plurals and word forms',
      'Big and small letters',
      'Accents and special letters',
      'Hyphens and joined words',
      'Numbers and units',
      'Little words (stop words)',
      'Same meaning, other word',
      'Typos',
      'Half-typed words',
      'Brands, codes and symbols',
    ]);
    LESSONS.forEach((l) => expect(l.cases).toHaveLength(10));
    expect(ALL).toHaveLength(100);
  });

  it('gives each lesson one sentence and a unique id, and no empty test', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(10);
    LESSONS.forEach((l) => expect(l.teaches.trim().length).toBeGreaterThan(20));
    ALL.forEach(([saved, typed]) => {
      expect(saved.trim()).not.toBe('');
      expect(typed.trim()).not.toBe('');
    });
  });
});

describe('the examples (R1.6)', () => {
  it('has three examples, each with one sentence, and each can be read', () => {
    expect(EXAMPLES.map((e) => e.name)).toEqual(['Just the defaults', 'English analyzers', 'Online shop']);
    EXAMPLES.forEach((e) => {
      expect(e.say.length).toBeGreaterThan(20);
      expect(readDefinition(JSON.stringify(e.body)).ok).toBe(true);
    });
  });

  it('finds the same numbers as the approved prototype, with "any word"', () => {
    expect(countFound(example('defaults'), 'title', 'any', ALL)).toBe(34);
    expect(countFound(example('english'), 'title_folded', 'any', ALL)).toBe(53);
    expect(countFound(example('shop'), 'title', 'any', ALL)).toBe(78);
  });

  it('names the best field of each example, as the example list shows it', () => {
    expect(bestFieldFinds(example('defaults'), ALL)).toBe(34);
    expect(bestFieldFinds(example('english'), ALL)).toBe(53);
    expect(bestFieldFinds(example('shop'), ALL)).toBe(78);
  });

  it('keeps "found" the same with "all words", and turns "partly found" into "not found"', () => {
    const def = example('shop');
    const tally = (mode: 'any' | 'all') => {
      const field = listFields(def.mappings, def.analysis).find((f) => f.path === 'title');
      const index = field && chainFor(field, 'index', def.analysis);
      const search = field && chainFor(field, 'search', def.analysis);
      if (!index || !search || 'error' in index || 'error' in search) throw new Error('no chain');
      const count: Record<string, number> = {};
      ALL.forEach(([saved, typed]) => {
        const r = compareTokens(finalTokens(analyzeInBrowser(index, saved)), finalTokens(analyzeInBrowser(search, typed)), mode).result;
        count[r] = (count[r] ?? 0) + 1;
      });
      return count;
    };
    const any = tally('any');
    const all = tally('all');
    expect(any.found).toBe(78);
    expect(all.found).toBe(78);
    expect(any.partly).toBeGreaterThan(0);
    expect(all.partly).toBeUndefined();
    expect(all.not_found).toBe((any.not_found ?? 0) + (any.partly ?? 0));
  });
});
