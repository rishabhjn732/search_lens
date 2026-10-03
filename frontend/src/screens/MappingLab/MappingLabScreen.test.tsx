import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { createLabStore } from './labStore';
import { resetLabStoreForTests } from './useLabStore';

function renderLab(path = '/mapping-lab') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const box = () => screen.getByLabelText('Index definition (JSON)') as HTMLTextAreaElement;
const status = () => screen.getByRole('status');
const card = (path: string) => screen.getByRole('article', { name: `Field ${path}` });
const cards = () => screen.queryAllByRole('article');
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const slow = { timeout: 2500 }; // the screen waits about 350 ms after typing

const COMPACT = '{"mappings":{"properties":{"t":{"type":"text"}}}}';

beforeEach(() => {
  localStorage.clear();
  resetLabStoreForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mapping lab: opening (R5.1, R5.5, R1.9)', () => {
  it('opens without a cluster, says it is a close copy, and shows the Online shop example', () => {
    renderLab();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Close copy: tokens are made in this page and can differ a little from OpenSearch. Connect to a cluster for exact tokens.',
    );
    expect(box().value).toContain('"shop_text"');
    expect(status()).toHaveTextContent('✓ Read 8 fields and 3 analyzers you made.');
  });

  it('is reached from the header', () => {
    renderLab('/');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Mapping lab' }));
    expect(box()).toBeInTheDocument();
  });

  it('never calls the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: /English analyzers/ }));
    type(COMPACT);
    await waitFor(() => expect(status()).toHaveTextContent('Read 1 field'), slow);
    await within(card('t')).findByText('Finds 34 of 100 test searches');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Mapping lab: paste (R1.1, R1.3, R1.4, R1.5, R1.7)', () => {
  it('reads the text a moment after typing stops', async () => {
    renderLab();
    type(COMPACT);
    expect(status()).toHaveTextContent('Read 8 fields'); // not yet
    await waitFor(() => expect(status()).toHaveTextContent('✓ Read 1 field and 0 analyzers you made.'), slow);
    expect(cards()).toHaveLength(1);
  });

  it('shows line and column for a JSON mistake and keeps the last good result', async () => {
    renderLab();
    type('{\n  "mappings": {"properties": {}},\n}');
    await waitFor(() => expect(status()).toHaveTextContent('Cannot read this yet. Line 3, column 1: Remove the comma before }.'), slow);
    expect(status()).toHaveClass('bad');
    expect(cards()).toHaveLength(8);
  });

  it('says what to paste when mappings.properties is missing', async () => {
    renderLab();
    type('{"settings": {}}');
    await waitFor(() => expect(status()).toHaveTextContent('No "mappings.properties" found.'), slow);
    expect(cards()).toHaveLength(8);
  });

  it('counts the problems to fix', async () => {
    renderLab();
    type('{"mappings":{"properties":{"t":{"type":"text","analyzer":"nope"},"u":{"type":"text","analyzer":"nada"}}}}');
    await waitFor(() => expect(status()).toHaveTextContent('2 problems to fix: see the red notes below.'), slow);
  });

  it('tidies the JSON, and shows the mistake when it cannot', () => {
    renderLab();
    type(COMPACT);
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(box().value).toBe(JSON.stringify(JSON.parse(COMPACT), null, 2));
    expect(status()).toHaveTextContent('Read 1 field');

    type('{"a": 1,}');
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(box().value).toBe('{"a": 1,}');
    expect(status()).toHaveTextContent('Cannot read this yet. Line 1, column 9: Remove the comma before }.');
  });

  it('clears the box and shows no result (R1.7)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(box().value).toBe('');
    expect(status()).toHaveTextContent('Paste an index definition, or pick an example.');
    expect(cards()).toHaveLength(0);
    expect(screen.queryByText('Your fields, as pictures')).toBeNull();
  });
});

describe('Mapping lab: examples (R1.6)', () => {
  it('shows three examples with how many of the 100 tests the best field finds', () => {
    renderLab();
    expect(screen.getByText('best field finds 34 of 100')).toBeInTheDocument();
    expect(screen.getByText('best field finds 53 of 100')).toBeInTheDocument();
    expect(screen.getByText('best field finds 78 of 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Online shop/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fills the box when an example is chosen', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: /English analyzers/ }));
    expect(box().value).toContain('"title_folded"');
    expect(status()).toHaveTextContent('Read 3 fields and 1 analyzer you made.');
    expect(screen.getByRole('button', { name: /English analyzers/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Online shop/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Mapping lab: field cards (R2.1 to R2.5, R2.8)', () => {
  it('shows one card per field, with extra ways to save a field, and none for objects', () => {
    renderLab();
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual([
      'Field title', 'Field title.suggest', 'Field title.raw', 'Field description', 'Field brand', 'Field price', 'Field in_stock', 'Field created_at',
    ]);
    expect(within(card('title.suggest')).getByText('extra way to save title')).toBeInTheDocument();

    type('{"mappings":{"properties":{"http":{"properties":{"status":{"type":"integer"}}}}}}');
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Field http.status']);
  });

  it('describes a text field in one sentence, with its steps and its saved tokens', async () => {
    renderLab();
    const title = within(card('title'));
    expect(title.getByText(/^HTML removed, then symbols swapped, then cut at spaces, then split at hyphens/)).toBeInTheDocument();
    for (const name of ['html_strip', 'symbols', 'whitespace', 'shop_parts', 'lowercase', 'english_stemmer']) {
      expect(title.getByText(name)).toBeInTheDocument();
    }
    expect(title.getByText('whitespace')).toHaveClass('pill', 't');
    expect(title.getByText('html_strip')).toHaveClass('c');
    expect(title.getByText('lowercase')).toHaveClass('f');
    expect(await title.findByText('wifi')).toHaveClass('chip');
    expect(title.getByText('cafe')).toBeInTheDocument();
  });

  it('says when searching uses other steps, and shows them', async () => {
    renderLab();
    const suggest = within(card('title.suggest'));
    expect(suggest.getByText(/Searching uses other steps: "autocomplete_search"\./)).toBeInTheDocument();
    expect(suggest.getByText('searched with')).toBeInTheDocument();
    await waitFor(() => expect(suggest.getByText('typed tokens').nextElementSibling).toHaveTextContent('women\'s'));
    expect(within(card('title')).queryByText(/Searching uses other steps/)).toBeNull();
  });

  it('says a keyword field is saved whole, with its normalizer steps if it has one', async () => {
    renderLab();
    const raw = within(card('title.raw'));
    expect(raw.getByText('Saved whole, exactly as written. "Nike" and "nike" are different.')).toBeInTheDocument();
    expect(await raw.findByText("Women's Running Shoes – Café Wi-Fi Edition")).toBeInTheDocument();
    const brand = within(card('brand'));
    expect(brand.getByText('Kept whole, then small letters, then accents removed.')).toBeInTheDocument();
    expect(brand.getByText('normalizer')).toBeInTheDocument();
  });

  it('says in one sentence how other types are found, and shows no tokens', () => {
    renderLab();
    expect(within(card('price')).getByText(/^A number\. Not split into words\./)).toBeInTheDocument();
    expect(within(card('in_stock')).getByText('Yes or no. Found by exact value only.')).toBeInTheDocument();
    expect(within(card('created_at')).getByText(/^A date\./)).toBeInTheDocument();
    expect(within(card('price')).queryByText('saved tokens')).toBeNull();
    expect(within(card('price')).queryByRole('button')).toBeNull();
  });

  it('updates every card when the example text changes (R2.5)', async () => {
    renderLab();
    fireEvent.change(screen.getByLabelText('Example text for every card'), { target: { value: 'Hand-made Soap' } });
    expect(await within(card('title')).findByText('handmade')).toBeInTheDocument();
    expect(await within(card('title.raw')).findByText('Hand-made Soap')).toBeInTheDocument();
    expect(within(card('title')).queryByText('wifi')).toBeNull();
  });

  it('shows how many tests each field finds, and marks the field to test (R2.8)', async () => {
    renderLab();
    expect(await within(card('title')).findByText('Finds 78 of 100 test searches')).toBeInTheDocument();
    expect(await within(card('title.raw')).findByText('Finds 0 of 100 test searches')).toBeInTheDocument();
    fireEvent.click(within(card('title.suggest')).getByRole('button', { name: /Test this field/ }));
    expect(card('title.suggest')).toHaveAttribute('aria-current', 'true');
    expect(card('title')).not.toHaveAttribute('aria-current');
  });

  it('works when React runs effects twice, as it does in development', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/mapping-lab']}>
          <AppRoutes />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await within(card('title')).findByText('Finds 78 of 100 test searches')).toBeInTheDocument();
  });
});

describe('Mapping lab: problems and things to check (R2.6, R2.7)', () => {
  it('shows a problem on its card instead of tokens, and leaves the field out of the tests', async () => {
    renderLab();
    type('{"mappings":{"properties":{"t":{"type":"text","analyzer":"nope"},"ok":{"type":"text"}}}}');
    const message = 'The analyzer "nope" is not defined in settings.analysis and is not a built-in analyzer.';
    await waitFor(() => expect(within(card('t')).getByText(message)).toBeInTheDocument(), slow);
    expect(within(card('t')).queryByText('saved tokens')).toBeNull();
    expect(within(card('t')).queryByRole('button')).toBeNull();
    expect(within(card('ok')).getByRole('button', { name: /Test this field/ })).toBeInTheDocument();
    const problem = within(screen.getByRole('list', { name: 'Things to check' })).getByText(message).closest('li');
    expect(problem).toHaveClass('problem');
    expect(status()).toHaveTextContent('1 problem to fix');
  });

  it('shows warnings and tips', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: /Just the defaults/ }));
    const list = within(screen.getByRole('list', { name: 'Things to check' }));
    expect(list.getByText(/^Keyword field without a normalizer/).closest('li')).toHaveClass('tip');
    expect(list.getByText(/^number_of_shards is not set/).closest('li')).toHaveClass('tip');
    expect(status()).not.toHaveClass('bad');

    type('{"settings":{"number_of_shards":1,"analysis":{"filter":{"h":{"type":"hunspell","locale":"en_US"}},"analyzer":{"a":{"type":"custom","tokenizer":"standard","filter":["h"]}}}},"mappings":{"properties":{"t":{"type":"text","analyzer":"a"}}}}');
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(screen.getByText(/"h" reads a file on the server disk\./).closest('li')).toHaveClass('warning');
  });
});

describe('Mapping lab: kept in this browser (R1.8)', () => {
  it('shows the last pasted definition again after a reload', async () => {
    const first = renderLab();
    type(COMPACT);
    await waitFor(() => expect(status()).toHaveTextContent('Read 1 field'), slow);
    first.unmount();

    resetLabStoreForTests(); // a reload makes a new store on the same browser storage
    renderLab();
    expect(box().value).toBe(COMPACT);
    expect(status()).toHaveTextContent('Read 1 field');
  });

  it('remembers Clear, and a broken text too', async () => {
    const first = renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    first.unmount();
    resetLabStoreForTests();
    const second = renderLab();
    expect(box().value).toBe('');
    type('{"a": }');
    await waitFor(() => expect(status()).toHaveTextContent('Cannot read this yet'), slow);
    second.unmount();
    resetLabStoreForTests();
    renderLab();
    expect(box().value).toBe('{"a": }');
  });

  it('says so when storage is full, and keeps working with what is on screen', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => undefined } as unknown as Storage;
    resetLabStoreForTests(createLabStore(full));
    renderLab();
    type(COMPACT);
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(screen.getByText(/^Storage is full\. Saving needs about/)).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });
});
