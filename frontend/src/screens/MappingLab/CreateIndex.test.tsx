import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { createBody, readDefinition, type Definition } from '../../analysis/definition';
import { EXAMPLES } from '../../analysis/tests';
import CreateIndex from './CreateIndex';
import { indexName, plainSummary, requestText } from './createRequest';
import { resetLabStoreForTests } from './useLabStore';

function define(body: unknown): Definition {
  const r = readDefinition(JSON.stringify(body));
  if (!r.ok) throw new Error(r.error.message);
  return r.definition;
}
const shop = () => define(EXAMPLES.find((e) => e.id === 'shop')!.body);
const code = () => screen.getByLabelText('Request to copy').textContent!;
const nameBox = () => screen.getByLabelText('Index name') as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  resetLabStoreForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('indexName', () => {
  it('makes a name OpenSearch accepts', () => {
    expect(indexName('  Shop V2!  ')).toBe('shop-v2-');
    expect(indexName('my_index.2026-10')).toBe('my_index.2026-10');
    expect(indexName('   ')).toBe('my-index');
  });
});

describe('requestText (R6.1 to R6.3)', () => {
  it('writes the Dev Tools request with the settings and mappings', () => {
    const def = shop();
    const text = requestText(def, 'products', 'dev');
    expect(text.startsWith('PUT /products\n{')).toBe(true);
    expect(JSON.parse(text.slice('PUT /products\n'.length))).toEqual(createBody(def));
  });

  it('writes a curl request that asks for the password, and has none in it', () => {
    const text = requestText(shop(), 'products', 'curl');
    expect(text.startsWith('curl -X PUT "https://localhost:9200/products" \\\n  -u admin \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{')).toBe(true);
    expect(text).not.toMatch(/-u admin:/);
    expect(text).not.toMatch(/password/i);
  });

  it('keeps a single quote in the body safe for the shell', () => {
    const def = define({ settings: { analysis: { filter: { s: { type: 'synonym', synonyms: ["women's => women"] } } } }, mappings: { properties: { t: { type: 'text' } } } });
    const text = requestText(def, 'x', 'curl');
    expect(text).toContain(`women'\\''s => women`);
    expect(text.endsWith(`}'`)).toBe(true);
  });

  it('removes what OpenSearch sets by itself (R6.2)', () => {
    const def = define({ my_index: { mappings: { properties: { t: { type: 'text' } } }, settings: { index: { number_of_shards: '2', uuid: 'u', creation_date: '1', version: { created: '1' }, provided_name: 'my_index' } } } });
    const text = requestText(def, 'my_index', 'dev');
    expect(text).toContain('"number_of_shards": "2"');
    for (const gone of ['uuid', 'creation_date', 'provided_name', '"version"', '"index"']) expect(text).not.toContain(gone);
  });
});

describe('plainSummary (R6.6)', () => {
  it('says what the request creates, in plain words', () => {
    expect(plainSummary(shop(), 'products')).toEqual([
      'An empty index called "products".',
      'Split into 1 part (shards), each with 1 backup copy (replicas).',
      'Your analyzer "shop_text": HTML removed, then symbols swapped, then cut at spaces, then split at hyphens, then small letters, then accents removed, then synonyms added, then some words protected, then cut to the root.',
      'Your analyzer "autocomplete": cut into words, then small letters, then accents removed, then first letters saved.',
      'Your analyzer "autocomplete_search": cut into words, then small letters, then accents removed.',
      '3 text fields (searched by words), 2 keyword fields (exact values, for filters and sorting), and 3 other (numbers, dates, yes/no).',
      'No documents. You add them later.',
    ]);
  });

  it('uses the right plurals and the defaults', () => {
    const two = define({ settings: { number_of_shards: 2, number_of_replicas: 2 }, mappings: { properties: { a: { type: 'text' } } } });
    expect(plainSummary(two, 'x').slice(0, 2)).toEqual(['An empty index called "x".', 'Split into 2 parts (shards), each with 2 backup copies (replicas).']);
    const none = define({ mappings: { properties: { a: { type: 'keyword' } } } });
    expect(plainSummary(none, 'x')[1]).toBe('Split into 1 part (shards), each with 1 backup copy (replicas).');
    expect(plainSummary(none, 'x')[2]).toBe('0 text fields (searched by words), 1 keyword field (exact values, for filters and sorting), and 0 other (numbers, dates, yes/no).');
  });
});

describe('CreateIndex: the part of the page', () => {
  it('shows the request, the plain list and the "never sends" note (R6.1, R6.5, R6.6)', () => {
    render(<CreateIndex definition={shop()} />);
    expect(screen.getByRole('heading', { name: /Create the index/ })).toBeInTheDocument();
    expect(screen.getByText('Search Lens never sends this request.')).toBeInTheDocument();
    expect(screen.getByText(/It is read-only\./)).toBeInTheDocument();
    expect(nameBox().value).toBe('products');
    expect(code().startsWith('PUT /products\n')).toBe(true);
    expect(screen.getByText('An empty index called "products".')).toBeInTheDocument();
    expect(screen.getByText('No documents. You add them later.')).toBeInTheDocument();
  });

  it('changes the request with the name and the format (R6.1, R6.3)', () => {
    render(<CreateIndex definition={shop()} />);
    fireEvent.change(nameBox(), { target: { value: 'Shop_V2' } });
    expect(code().startsWith('PUT /shop_v2\n')).toBe(true);
    expect(screen.getByText('An empty index called "shop_v2".')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'curl' }));
    expect(screen.getByRole('button', { name: 'curl' })).toHaveAttribute('aria-pressed', 'true');
    expect(code()).toContain('curl -X PUT "https://localhost:9200/shop_v2"');
    expect(code()).toContain('-u admin \\');
    expect(screen.getByText(/curl asks for the password/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dev Tools' }));
    expect(code().startsWith('PUT /shop_v2\n')).toBe(true);
  });

  it('copies the text and says what happened (R6.4)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CreateIndex definition={shop()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Copied. Paste it in Dev Tools and press Run.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(code());
  });

  it('says when copying failed, or is not possible (R6.4)', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const first = render(<CreateIndex definition={shop()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Could not copy. Select the text and copy it by hand.')).toBeInTheDocument();
    first.unmount();

    vi.stubGlobal('navigator', {});
    render(<CreateIndex definition={shop()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Could not copy. Select the text and copy it by hand.')).toBeInTheDocument();
  });

  it('says OpenSearch will refuse an index with a problem (R6.7)', () => {
    const bad = define({ mappings: { properties: { t: { type: 'text', analyzer: 'nope' } } } });
    render(<CreateIndex definition={bad} />);
    expect(screen.getByText('OpenSearch will refuse this index: fix the red problems in step 2 first.')).toBeInTheDocument();
    const good = render(<CreateIndex definition={shop()} />);
    expect(within(good.container).queryByText(/will refuse/)).toBeNull();
  });
});

describe('Mapping lab page: create the index (R1.2, R6.8)', () => {
  it('uses the index name of a pasted GET answer, and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/mapping-lab']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(nameBox().value).toBe('products');
    fireEvent.change(screen.getByLabelText('Index definition (JSON)'), {
      target: { value: '{"my_index": {"mappings": {"properties": {"t": {"type": "text"}}}, "settings": {"index": {"uuid": "abc", "number_of_shards": "1"}}}}' },
    });
    await waitFor(() => expect(nameBox().value).toBe('my_index'), { timeout: 2500 });
    expect(code()).toContain('PUT /my_index');
    expect(code()).not.toContain('uuid');

    fireEvent.change(nameBox(), { target: { value: 'other' } });
    expect(code()).toContain('PUT /other');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByRole('link', { name: /Create the index/ })).toHaveAttribute('href', '#create');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
