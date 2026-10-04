import { describe, expect, it } from 'vitest';
import { parseRequestBlock, withToggles } from './requestBlock';

describe('parseRequestBlock', () => {
  it('parses a GET _search request with a body', () => {
    const result = parseRequestBlock('GET products/_search\n{"query": {"match_all": {}}}');

    expect(result).toEqual({
      ok: true,
      method: 'GET',
      index: 'products',
      path: '/products/_search',
      body: { query: { match_all: {} } },
    });
  });

  it('parses a POST _validate/query request', () => {
    const result = parseRequestBlock('POST products/_validate/query\n{"query": {"match_all": {}}}');

    expect(result).toMatchObject({ ok: true, method: 'POST', path: '/products/_validate/query' });
  });

  it('accepts a leading slash on the path', () => {
    const result = parseRequestBlock('GET /products/_search\n{}');

    expect(result).toMatchObject({ ok: true, index: 'products' });
  });

  it('defaults to an empty body when none is given', () => {
    const result = parseRequestBlock('GET products/_search');

    expect(result).toMatchObject({ ok: true, body: {} });
  });

  it('rejects a first line that is not a method and a path', () => {
    const result = parseRequestBlock('products/_search\n{}');

    expect(result).toEqual({
      ok: false,
      message: 'The first line must be a method and a path ending in _search, like GET products/_search.',
    });
  });

  it('rejects a path that does not end in _search or _validate/query', () => {
    const result = parseRequestBlock('GET products/_mapping\n{}');

    expect(result.ok).toBe(false);
  });

  it('reports a line/column for broken JSON', () => {
    const result = parseRequestBlock('GET products/_search\n{ "a": 1, }');

    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/Line \d+, column \d+/);
  });

  it('rejects a body that is not a JSON object', () => {
    const result = parseRequestBlock('GET products/_search\n[1, 2]');

    expect(result).toEqual({ ok: false, message: 'The body must be a JSON object, like {"query": {...}}.' });
  });
});

describe('withToggles', () => {
  it('overwrites explain, profile, and size, and keeps other keys', () => {
    const body = { query: { match_all: {} }, sort: ['_score'] };

    const result = withToggles(body, { explain: true, profile: false, validate: false });

    expect(result).toEqual({ query: { match_all: {} }, sort: ['_score'], explain: true, profile: false, size: 10 });
  });

  it('overwrites explain/profile already set on the pasted body', () => {
    const body = { query: {}, explain: false, profile: true, size: 500 };

    const result = withToggles(body, { explain: true, profile: false, validate: false });

    expect(result).toMatchObject({ explain: true, profile: false, size: 10 });
  });
});
