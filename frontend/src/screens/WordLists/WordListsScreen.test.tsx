import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { resetWordListStoreForTests } from '../../wordlists/useWordLists';

function renderAt(path = '/word-lists') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const file = (name: string, text: string) => new File([text], name, { type: 'text/plain' });

function upload(type: string, ...files: File[]) {
  const input = document.getElementById(`file-${type}`) as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

function filesBox() {
  return screen.getByRole('heading', { name: /^(Saved files|Dictionaries)/ }).closest('.box') as HTMLElement;
}

function tab(name: RegExp) {
  return screen.getByRole('tab', { name });
}

beforeEach(() => {
  localStorage.clear();
  resetWordListStoreForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Word lists page', () => {
  it('R2.1 is in the header and shows four tabs with counts (sample data, R2.9)', () => {
    renderAt('/');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Word lists' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Word lists' })).toBeInTheDocument();
    expect(tab(/Entities/)).toHaveTextContent('Entities 11');
    expect(tab(/Protected words/)).toHaveTextContent('Protected words 7');
    expect(tab(/Synonyms/)).toHaveTextContent('Synonyms 8');
    expect(tab(/Hunspell/)).toHaveTextContent('Hunspell 1');
    expect(tab(/Entities/)).toHaveAttribute('aria-selected', 'true');
  });

  it('R2.2 lists each file with its count, on/off switch and Remove button', () => {
    renderAt();
    const box = filesBox();

    expect(within(box).getByText('entity.txt')).toBeInTheDocument();
    expect(within(box).getByText(/8 entities · just now/)).toBeInTheDocument();
    expect(within(box).getByRole('switch', { name: 'Use entity.txt' })).toHaveAttribute('aria-checked', 'true');
    expect(within(box).getByRole('switch', { name: 'Use brands-2026.txt' })).toHaveAttribute('aria-checked', 'false');
    expect(within(box).getByRole('button', { name: 'Remove entity.txt' })).toBeInTheDocument();
  });

  it('R1.1 uploads a good file: it is listed and a message says how many entries', async () => {
    renderAt();

    upload('entity', file('company.txt', 'ai supplychain\ngenerative ai\n'));

    expect(await screen.findByText('Saved company.txt: 2 entities.')).toBeInTheDocument();
    expect(within(filesBox()).getByText('company.txt')).toBeInTheDocument();
    expect(tab(/Entities/)).toHaveTextContent('Entities 13');
  });

  it('R1.2 refuses a bad file and shows each problem with its line number', async () => {
    renderAt();
    fireEvent.click(tab(/Synonyms/));

    upload('synonym', file('bad.txt', 'sneakers, running shoes\ntv =>\ncouch,,sofa\nsofa\n'));

    expect(await screen.findByText('Not saved. bad.txt has 3 problems:')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Line 2: Put words on both sides of "=>"');
    expect(alert).toHaveTextContent('Line 3: There is an empty word between commas.');
    expect(alert).toHaveTextContent('Line 4: "sofa" has only one word.');
    expect(within(filesBox()).queryByText('bad.txt')).toBeNull();
  });

  it('R1.2 lists at most 5 problems, then "… and N more."', async () => {
    renderAt();

    upload('entity', file('many.txt', 'a\nb\nc\nd\ne\nf\ng\n'));

    expect(await screen.findByText('… and 2 more.')).toBeInTheDocument();
  });

  it('R1.3 warns about a duplicate line but saves the file', async () => {
    renderAt();

    upload('entity', file('dup.txt', 'new york\nnew york\n'));

    expect(await screen.findByText('Saved dup.txt: 1 entity.')).toBeInTheDocument();
    expect(screen.getByText(/"new york" is already on line 1\. Kept once\./)).toBeInTheDocument();
  });

  it('R1.7 adds a Hunspell .aff + .dic pair', async () => {
    renderAt('/word-lists#hunspell');

    upload('hunspell', file('en_GB.aff', 'SET UTF-8\n'), file('en_GB.dic', '2\nrun/S\nshoe\n'));

    expect(await screen.findByText('Saved en_GB: 2 words.')).toBeInTheDocument();
    expect(tab(/Hunspell/)).toHaveTextContent('Hunspell 2');
  });

  it('R2.4 Remove asks first; "Cancel" keeps the file', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Remove entity.txt' }));

    expect(confirm).toHaveBeenCalledWith('Remove entity.txt? Its 8 entities will be deleted from this browser.');
    expect(within(filesBox()).getByText('entity.txt')).toBeInTheDocument();
  });

  it('R2.4 Remove asks first; "OK" deletes the file, also after a reload', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { unmount } = renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Remove entity.txt' }));

    expect(screen.getByText('Removed entity.txt.')).toBeInTheDocument();
    expect(within(filesBox()).queryByText('entity.txt')).toBeNull();
    expect(tab(/Entities/)).toHaveTextContent('Entities 3');

    unmount();
    resetWordListStoreForTests();
    renderAt();
    expect(within(filesBox()).queryByText('entity.txt')).toBeNull();
  });

  it('R2.3 turning a file off keeps it and the "try it" box stops using it', () => {
    renderAt();
    expect(screen.getByText(/6 tokens became 5\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Use entity.txt' }));

    expect(screen.getByRole('switch', { name: 'Use entity.txt' })).toHaveAttribute('aria-checked', 'false');
    // brands-2026.txt was already off, so now two files say "off".
    expect(within(filesBox()).getAllByText(/· off/)).toHaveLength(2);
    expect(screen.getByText('No entity file is on. Turn one on to see entities join.')).toBeInTheDocument();
  });

  it('R2.5 shows the entries of the chosen file with a filter', () => {
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: /^brands-2026\.txt/ }));
    expect(screen.getByRole('heading', { name: /brands-2026\.txt,\s*showing 3 of 3/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter entries' }), { target: { value: 'new' } });
    expect(screen.getByRole('heading', { name: /showing 1 of 1/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /new balance/ })).toBeInTheDocument();
  });

  it('R2.6 adds an entry after checking it; a bad entry keeps the typed text', () => {
    renderAt();
    const input = screen.getByRole('textbox', { name: 'New entry for entity.txt' });

    fireEvent.change(input, { target: { value: 'ai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('"ai" is one word.');
    expect(input).toHaveValue('ai');

    fireEvent.change(input, { target: { value: 'Data Mesh' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Added to entity.txt.')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /data mesh/ })).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('R2.7 removes an entry, but not the last one', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Remove new york' }));
    expect(screen.getByText('Removed "new york".')).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'new york' })).toBeNull();

    fireEvent.click(tab(/Protected words/));
    for (const w of ['iphone', 'adidas', 'running', 'news', 'kubernetes', 'opensearch']) {
      fireEvent.click(screen.getByRole('button', { name: `Remove ${w}` }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Remove wifi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This is the last entry. Remove the whole file instead.');
  });

  it('R2.8 Hunspell words cannot be added or removed one by one', () => {
    renderAt('/word-lists#hunspell');

    expect(screen.queryByRole('textbox', { name: /New entry/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove run' })).toBeNull();
    expect(screen.getByText(/Words come from the \.dic file/)).toBeInTheDocument();
  });

  it('R2.9 "Reset sample data" asks first, then brings the samples back', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt();
    upload('entity', file('mine.txt', 'new york\n'));
    await screen.findByText('Saved mine.txt: 1 entity.');

    fireEvent.click(screen.getByRole('button', { name: 'Reset sample data' }));

    expect(within(filesBox()).queryByText('mine.txt')).toBeNull();
    expect(tab(/Entities/)).toHaveTextContent('Entities 11');
  });

  it('R3.1 and R3.2 join entities into one token, longest first', () => {
    renderAt();
    const input = screen.getByRole('textbox', { name: 'Type some text' });

    fireEvent.change(input, { target: { value: 'Our supply chain management and AI SupplyChain' } });

    const joined = screen.getByTestId('joined-tokens');
    expect(within(joined).getByText('supply chain management')).toBeInTheDocument();
    expect(within(joined).getByText('ai supplychain')).toBeInTheDocument();
    expect(screen.getByText(/7 tokens became 4\./)).toBeInTheDocument();
  });

  it('R3.3 says when no entity is found', () => {
    renderAt();

    fireEvent.change(screen.getByRole('textbox', { name: 'Type some text' }), { target: { value: 'hello world' } });

    expect(screen.getByText('No entity found in this text. Try "ai supplychain" or "new york".')).toBeInTheDocument();
  });

  it('R4.2 shows the storage used', () => {
    renderAt();

    expect(screen.getByText(/KB of about 5\.0 MB used/)).toBeInTheDocument();
  });

  it('R4.4 never calls the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderAt();

    upload('entity', file('company.txt', 'ai supplychain\n'));
    await waitFor(() => expect(screen.getByText('Saved company.txt: 1 entity.')).toBeInTheDocument());

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
