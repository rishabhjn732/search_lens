import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { MAX_OWN_TESTS, OWN_TESTS_FULL, OWN_TEST_EMPTY } from './labStore';
import { labStore, resetLabStoreForTests } from './useLabStore';

function renderLab() {
  return render(
    <MemoryRouter initialEntries={['/mapping-lab']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const grid = () => screen.getByRole('table', { name: /Searches found for each lesson and field/ });
const cell = (field: string, lesson: string) => within(grid()).getByRole('button', { name: new RegExp(`^${field.replace('.', '\\.')}, ${lesson}:`) });
const rows = () => within(screen.getByRole('list', { name: 'Tests' })).getAllByRole('listitem');
const big = () => screen.getByText(/finds/, { selector: 'p.big' });
const lessonButton = (name: string) => within(screen.getByRole('group', { name: 'Lesson' })).getByRole('button', { name });
const showButton = (name: string) => within(screen.getByRole('group', { name: 'Show tests' })).getByRole('button', { name });
const slow = { timeout: 2500 };

// Every test runs about a thousand analyses; on a slow computer the first one can take a few seconds.
vi.setConfig({ testTimeout: 20000 });

// The tests have run when the first cell of the Online shop example shows its number.
const ready = () => screen.findByRole('button', { name: 'title, Plurals and word forms: 8 of 10 found' }, { timeout: 4000 });

beforeEach(() => {
  localStorage.clear();
  resetLabStoreForTests();
});

describe('Test section: the grid (R3.3, R3.4)', () => {
  it('shows lessons × fields with found/tests, totals and a scale', async () => {
    renderLab();
    expect((await ready()).textContent).toBe('8/10');
    expect(cell('title', 'Typos')).toHaveTextContent('0/10');
    expect(cell('title', 'Big and small letters')).toHaveTextContent('10/10');
    expect(within(grid()).getByText('78 / 100')).toBeInTheDocument();
    expect(within(grid()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'title', 'title.suggest', 'title.raw', 'description', 'brand',
    ]);
    expect(within(grid()).getAllByRole('rowheader')).toHaveLength(11); // 10 lessons and the totals row
    expect(screen.getByText('Click a number to see those tests.')).toBeInTheDocument();
  });

  it('leaves a field with a problem out of the grid (R2.7)', async () => {
    renderLab();
    fireEvent.change(screen.getByLabelText('Index definition (JSON)'), {
      target: { value: '{"mappings":{"properties":{"t":{"type":"text","analyzer":"nope"},"ok":{"type":"text"}}}}' },
    });
    await waitFor(() => expect(within(grid()).getByRole('button', { name: 'ok' })).toBeInTheDocument(), slow);
    expect(within(grid()).queryByRole('button', { name: 't' })).toBeNull();
  });

  it('shows the field and lesson of the chosen cell, column name or lesson name', async () => {
    renderLab();
    await ready();
    expect(big()).toHaveTextContent('The field title finds 78 of 100 searches.');

    fireEvent.click(cell('title', 'Typos'));
    expect(big()).toHaveTextContent('The field title finds 0 of 10 searches in "Typos".');
    expect(cell('title', 'Typos')).toHaveClass('sel');
    expect(rows()).toHaveLength(10);

    fireEvent.click(within(grid()).getByRole('button', { name: 'title.suggest' }));
    expect(big()).toHaveTextContent(/^The field title\.suggest finds \d+ of 100 searches\.$/);

    fireEvent.click(within(grid()).getByRole('button', { name: 'Accents and special letters' }));
    expect(big()).toHaveTextContent(/^The field title\.suggest finds \d+ of 10 searches in "Accents and special letters"\.$/);
    fireEvent.click(within(grid()).getByRole('button', { name: 'Accents and special letters' })); // again: all lessons
    expect(big()).toHaveTextContent('of 100 searches.');
  });

  it('opens the test section for a field from its card (R2.8)', async () => {
    renderLab();
    await ready();
    fireEvent.click(within(screen.getByRole('article', { name: 'Field description' })).getByRole('button', { name: /Test this field/ }));
    expect(big()).toHaveTextContent(/^The field description finds 43 of 100 searches\.$/);
  });
});

describe('Test section: any word or all words (R3.5)', () => {
  it('keeps "found" the same and turns "partly found" into "not found"', async () => {
    renderLab();
    await ready();
    expect(screen.getByRole('button', { name: 'Any word' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Like a normal "match" query: one found word is enough to show the product.')).toBeInTheDocument();
    expect(big()).toHaveTextContent('finds 78 of 100');

    fireEvent.click(showButton('Partly'));
    const partly = rows().length;
    expect(partly).toBeGreaterThan(0);
    expect(within(rows()[0]).getByText('Partly found')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All words' }));
    expect(screen.getByRole('button', { name: 'All words' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Like "operator": "and": every typed word must be found.')).toBeInTheDocument();
    expect(screen.getByText('No tests here. Try another filter.')).toBeInTheDocument();
    expect(big()).toHaveTextContent('finds 78 of 100');
    fireEvent.click(showButton('Not found'));
    expect(rows()).toHaveLength(22); // 100 - 78: the partly found tests are not found now
  });
});

describe('Test section: the summary (R3.6, R3.7, R4.1)', () => {
  it('splits the tests into found, partly found and not found, and says what would help most', async () => {
    renderLab();
    await ready();
    const bar = screen.getByRole('img', { name: /found,.*partly found,.*not found/ });
    const [found, partly, notFound] = bar.getAttribute('aria-label')!.match(/\d+/g)!.map(Number);
    expect(found).toBe(78);
    expect(found + partly + notFound).toBe(100);

    const helps = screen.getByRole('heading', { name: 'What would help most' }).parentElement!;
    const items = within(helps).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(4);
    expect(items[0]).toHaveTextContent(/\d+ tests?$/);
    const counts = items.map((i) => Number(/(\d+) tests?$/.exec(i.textContent!)![1]));
    expect([...counts].sort((a, b) => b - a)).toEqual(counts); // most helpful first
  });

  it('says nothing needs fixing when every search is found', async () => {
    renderLab();
    await ready();
    fireEvent.click(cell('title', 'Big and small letters'));
    expect(screen.getByText('Nothing to fix here. Every search is found.')).toBeInTheDocument();
  });

  it('shows progress while the tests run, and not afterwards (R4.1)', async () => {
    renderLab();
    expect(screen.getByRole('progressbar', { name: 'Running the tests' })).toBeInTheDocument();
    expect(screen.getByText(/Running the tests: 0 of [\d,]+/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull(), { timeout: 4000 });
  });
});

describe('Test section: the list (R3.8, R3.9)', () => {
  it('shows 30 tests at a time, with "Show more"', async () => {
    renderLab();
    await ready();
    expect(rows()).toHaveLength(30);
    fireEvent.click(screen.getByRole('button', { name: 'Show more (70 left)' }));
    expect(rows()).toHaveLength(60);
    fireEvent.click(screen.getByRole('button', { name: 'Show more (40 left)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show more (10 left)' }));
    expect(rows()).toHaveLength(100);
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
  });

  it('shows the result, lesson, both texts and both token lists, found in green', async () => {
    renderLab();
    await ready();
    const first = within(rows()[0]);
    expect(first.getByText('Found')).toHaveClass('verdict', 'found');
    expect(first.getByText('Plurals and word forms')).toBeInTheDocument();
    expect(first.getByText('Running Shoes for Men')).toBeInTheDocument();
    const shoes = first.getAllByText('shoe', { selector: '.chip' }); // the saved side and the typed side
    expect(shoes).toHaveLength(2);
    shoes.forEach((chip) => expect(chip).toHaveClass('found'));
    expect(first.queryByText(/The document has/)).toBeNull();
  });

  it('shows a missing typed token in red, and one reason with the fix', async () => {
    renderLab();
    await ready();
    fireEvent.click(lessonButton('Plurals and word forms'));
    fireEvent.click(showButton('Not found'));
    const row = within(rows().find((r) => within(r).queryByText('Running Jacket'))!);
    expect(row.getByText('Not found')).toHaveClass('verdict', 'not_found');
    expect(row.getByText('ran', { selector: '.chip' })).toHaveClass('missing');
    expect(row.getByText('synonym')).toBeInTheDocument();
    expect(row.getByText(/The document has no word like "ran"\. If they mean the same thing, add a synonym\./)).toBeInTheDocument();
  });

  it('says what the lesson teaches, and filters by result', async () => {
    renderLab();
    await ready();
    fireEvent.click(lessonButton('Typos'));
    expect(screen.getByText(/Analysis never fixes typos/)).toBeInTheDocument();
    expect(lessonButton('Typos')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(showButton('Found'));
    expect(screen.getByText('No tests here. Try another filter.')).toBeInTheDocument();
    fireEvent.click(showButton('All'));
    expect(rows()).toHaveLength(10);
    expect(within(rows()[0]).getByText('fuzziness')).toBeInTheDocument();
  });
});

describe('Test section: an open test (R3.10, R7.3)', () => {
  it('shows the saved side and the typed side step by step, and the raw answer', async () => {
    renderLab();
    await ready();
    const row = rows()[0];
    fireEvent.click(within(row).getByRole('button', { expanded: false }));
    expect(within(row).getByRole('button', { expanded: true })).toBeInTheDocument();
    const detail = within(row);
    expect(detail.getByText('Saved in the index')).toBeInTheDocument();
    expect(detail.getByText('Typed by the shopper')).toBeInTheDocument();
    expect(detail.getAllByText('shop_text')).toHaveLength(2); // the name of the chain, on both sides
    for (const step of ['original text', 'html_strip', 'symbols', 'whitespace', 'lowercase', 'english_stemmer']) {
      expect(detail.getAllByText(step).length).toBeGreaterThanOrEqual(2);
    }
    expect(detail.getAllByText('Cuts the text only at spaces. Punctuation stays inside the words.')).toHaveLength(2);
    expect(detail.getByText('was Running')).toBeInTheDocument(); // lowercase changed "Running"
    expect(detail.getAllByText('was shoes').length).toBeGreaterThan(0); // the stemmer changed "shoes"
    expect(detail.getByText('Show the raw analysis answer (saved text)')).toBeInTheDocument();
    expect(detail.getByText(/"custom_analyzer": true/)).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { expanded: true }));
    expect(within(row).queryByText('Saved in the index')).toBeNull();
  });

  it('says in the open test when a step is not copied in this page', async () => {
    renderLab();
    fireEvent.change(screen.getByLabelText('Index definition (JSON)'), {
      target: {
        value:
          '{"settings":{"number_of_shards":1,"analysis":{"filter":{"h":{"type":"hunspell","locale":"en_US"}},"analyzer":{"a":{"type":"custom","tokenizer":"standard","filter":["h"]}}}},"mappings":{"properties":{"t":{"type":"text","analyzer":"a"}}}}',
      },
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Read 1 field'), slow);
    await waitFor(() => expect(rows()[0]).toBeInTheDocument(), slow);
    fireEvent.click(within(rows()[0]).getByRole('button', { expanded: false }));
    expect(
      await within(rows()[0]).findByText('Token filter "h" (hunspell) is not copied in this page; tokens were passed through unchanged.'),
    ).toBeInTheDocument();
    expect(within(rows()[0]).getAllByText('Not copied in this page. A real cluster runs it.').length).toBeGreaterThan(0);
  });
});

describe('Test section: your own tests (R3.11)', () => {
  const addOwn = (saved: string, typed: string) => {
    fireEvent.change(screen.getByLabelText('Your own test: saved text'), { target: { value: saved } });
    fireEvent.change(screen.getByLabelText('What the shopper types'), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: 'Add test' }));
  };

  it('adds a test as the lesson "My tests", keeps it after a reload, and removes it', async () => {
    const first = renderLab();
    await ready();
    addOwn('Nike Air Zoom Pegasus 40', 'pegasus');
    expect(within(grid()).getByRole('button', { name: 'My tests' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(big()).toHaveTextContent('The field title finds 1 of 1 searches in "My tests".'), slow);
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText('Nike Air Zoom Pegasus 40')).toBeInTheDocument();
    expect((screen.getByLabelText('Your own test: saved text') as HTMLInputElement).value).toBe(''); // the form is empty again
    expect(within(grid()).getByText('79 / 101')).toBeInTheDocument(); // the new test is found too
    first.unmount();

    resetLabStoreForTests(); // a reload
    renderLab();
    await waitFor(() => expect(within(grid()).getByRole('button', { name: 'My tests' })).toBeInTheDocument(), slow);

    fireEvent.click(within(grid()).getByRole('button', { name: 'My tests' }));
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Remove this test' }));
    expect(within(grid()).queryByRole('button', { name: 'My tests' })).toBeNull();
    expect(big()).toHaveTextContent('of 100 searches.');
  });

  it('asks for both texts', async () => {
    renderLab();
    await ready();
    addOwn('Nike', '  ');
    expect(screen.getByRole('alert')).toHaveTextContent(OWN_TEST_EMPTY);
  });

  it('allows 200 own tests and then says so', async () => {
    resetLabStoreForTests();
    for (let i = 0; i < MAX_OWN_TESTS; i++) labStore().addOwnTest(`saved ${i}`, `typed ${i}`);
    renderLab();
    await ready();
    addOwn('one more', 'one more');
    expect(screen.getByRole('alert')).toHaveTextContent(OWN_TESTS_FULL);
    expect(within(grid()).getByText('78 / 300')).toBeInTheDocument();
  });
});

describe('Test section: nothing to test', () => {
  it('says so when there is no text or keyword field', () => {
    renderLab();
    fireEvent.change(screen.getByLabelText('Index definition (JSON)'), { target: { value: '{"mappings":{"properties":{"n":{"type":"integer"}}}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tidy the JSON' }));
    expect(screen.getByText('This index has no text or keyword fields to test.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
