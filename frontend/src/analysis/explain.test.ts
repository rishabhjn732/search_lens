import { describe, expect, it } from 'vitest';
import {
  fieldsNotCounted,
  filtersPassed,
  formulaOf,
  plainWordsForQuery,
  queryWarnings,
  scoreRows,
  splitVariable,
  type RawExplanationNode,
} from './explain';
import type { Field } from './types';

// A single match clause (not wrapped in a bool "sum of:"), the most common real shape — the
// root itself is the meaningful weight(...) node, not a combinator to unwrap.
const SINGLE_CLAUSE_EXPLANATION: RawExplanationNode = {
  value: 3.1407292,
  description: 'weight(title:iphon in 14652) [PerFieldSimilarity], result of:',
  details: [
    {
      value: 3.5881114,
      description: 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:',
      details: [
        { value: 291368, description: 'N, total number of documents with field' },
        { value: 8056, description: 'n, number of documents containing term' },
      ],
    },
    {
      value: 0.8753154,
      description: 'tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:',
      details: [
        { value: 11.0, description: 'freq, occurrences of term within document' },
        { value: 1.2, description: 'k1, term saturation parameter' },
        { value: 0.75, description: 'b, length normalization parameter' },
        { value: 27.0, description: 'dl, length of field' },
        { value: 19.18, description: 'avgdl, average length of field' },
      ],
    },
  ],
};

const HIT_EXPLANATION: RawExplanationNode = {
  value: 3.2,
  description: 'sum of:',
  details: [
    {
      value: 3.2,
      description: 'weight(title:nike in 0) [PerFieldSimilarity], result of:',
      details: [
        { value: 1.6, description: 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5))' },
        { value: 2.0, description: 'boost' },
      ],
    },
  ],
};

const MISS_EXPLANATION: RawExplanationNode = {
  value: 0,
  description: 'Failure to meet condition(s) of required/prohibited clause(s)',
  details: [{ value: 0, description: 'no match on required clause (brand:nike)' }],
};

const FILTERED_HIT_EXPLANATION: RawExplanationNode = {
  value: 3.2,
  description: 'sum of:',
  details: [
    {
      value: 3.2,
      description: 'weight(title:nike in 0) [PerFieldSimilarity], result of:',
      details: [
        { value: 1.6, description: 'idf' },
        { value: 2.0, description: 'tf' },
      ],
    },
    {
      value: 0,
      description: 'ConstantScoreQuery(brand:nike), product of:',
      details: [],
    },
  ],
};

describe('scoreRows', () => {
  it('turns the top-level details into rows with field labels and a plain sentence', () => {
    const rows = scoreRows(HIT_EXPLANATION);

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('title:nike');
    expect(rows[0].value).toBe(3.2);
    expect(rows[0].sentence).toContain('idf 1.60');
    expect(rows[0].sentence).toContain('boost of 2.00');
    expect(rows[0].children).toHaveLength(2);
  });

  it('falls back to the explanation itself when there are no details', () => {
    const rows = scoreRows({ value: 0, description: 'no match' });

    expect(rows).toHaveLength(1);
    expect(rows[0].sentence).toBe('no match');
  });

  it('does not unwrap a single (non-bool) clause into its idf/tf/boost children (regression)', () => {
    const rows = scoreRows(SINGLE_CLAUSE_EXPLANATION);

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('title:iphon');
    expect(rows[0].value).toBeCloseTo(3.1407292);
    expect(rows[0].children.map((c) => c.metric)).toEqual(['idf', 'tf']);
  });

  it('marks a zero-value row as non-scoring', () => {
    const rows = scoreRows(MISS_EXPLANATION);

    expect(rows[0].kind).toBe('non-scoring');
  });
});

describe('filtersPassed', () => {
  it('lists the ConstantScoreQuery clause names found anywhere in the tree', () => {
    expect(filtersPassed(FILTERED_HIT_EXPLANATION)).toEqual(['brand:nike']);
  });

  it('returns an empty list when there are no filter clauses', () => {
    expect(filtersPassed(HIT_EXPLANATION)).toEqual([]);
  });
});

describe('fieldsNotCounted', () => {
  it('lists a queried field that never appears as a weight(...) node', () => {
    const result = fieldsNotCounted(['title', 'description'], HIT_EXPLANATION);

    expect(result).toEqual([
      { field: 'description', reason: expect.stringContaining('did not add to this document\'s score') },
    ]);
  });

  it('returns an empty list when every queried field counted', () => {
    expect(fieldsNotCounted(['title'], HIT_EXPLANATION)).toEqual([]);
  });
});

describe('plainWordsForQuery', () => {
  it('restates a match clause', () => {
    expect(plainWordsForQuery({ match: { title: 'nike shoes' } })).toBe(
      'Your query looks for the words of "nike shoes" in title.',
    );
  });

  it('restates a bool clause', () => {
    expect(
      plainWordsForQuery({
        bool: { must: [{ match: { title: 'nike' } }], filter: [{ term: { brand: 'nike' } }] },
      }),
    ).toBe('Your query must match 1 condition, and must also pass 1 condition.');
  });

  it('says it cannot read something that is not an object', () => {
    expect(plainWordsForQuery('not a query')).toBe('This is not a query this tool can read.');
  });
});

describe('queryWarnings', () => {
  const fields: Field[] = [
    { path: 'title', type: 'text', kind: 'text' },
    { path: 'brand', type: 'keyword', kind: 'keyword' },
  ];

  it('warns about a term clause on a text field', () => {
    const warnings = queryWarnings({ term: { title: 'nike' } }, fields);

    expect(warnings).toEqual([
      {
        clause: 'term',
        field: 'title',
        message: expect.stringContaining('gets split into words'),
      },
    ]);
  });

  it('does not warn about a term clause on a keyword field', () => {
    expect(queryWarnings({ term: { brand: 'nike' } }, fields)).toEqual([]);
  });

  it('finds a term clause nested inside a bool query', () => {
    const warnings = queryWarnings({ bool: { filter: [{ term: { title: 'nike' } }] } }, fields);

    expect(warnings).toHaveLength(1);
  });
});

describe('splitVariable', () => {
  it('splits a short symbol from its description', () => {
    expect(splitVariable('n, number of documents containing term')).toEqual({
      symbol: 'n',
      desc: 'number of documents containing term',
    });
  });

  it('leaves a description whole when there is no comma', () => {
    expect(splitVariable('boost')).toEqual({ symbol: null, desc: 'boost' });
  });

  it('leaves a description whole when the first segment is not a short symbol', () => {
    expect(splitVariable('no match on required clause, brand:nike')).toEqual({
      symbol: null,
      desc: 'no match on required clause, brand:nike',
    });
  });
});

describe('formulaOf', () => {
  it('extracts the formula between "computed as" and "from:"', () => {
    expect(formulaOf('idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:')).toBe(
      'log(1 + (N - n + 0.5) / (n + 0.5))',
    );
  });

  it('returns null when there is no formula', () => {
    expect(formulaOf('boost')).toBeNull();
  });
});
