import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, createStore } from './store';

// A small in-memory Storage. With `limit`, setItem throws like a full browser storage.
class FakeStorage implements Storage {
  private items = new Map<string, string>();
  constructor(private limit = Infinity) {}
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (value.length > this.limit) throw new DOMException('full', 'QuotaExceededError');
    this.items.set(key, value);
  }
}

const file = (name: string, text: string) => new File([text], name, { type: 'text/plain' });

function emptyStore(storage: Storage = new FakeStorage()) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ files: [] }));
  return createStore(storage);
}

describe('word list store', () => {
  it('R2.9 shows the sample lists on the first visit', () => {
    const store = createStore(new FakeStorage());

    expect(store.list('entity').map((f) => f.name)).toEqual(['entity.txt', 'brands-2026.txt']);
    expect(store.list('hunspell')).toHaveLength(1);
  });

  it('R1.1 saves a good file and R4.1 keeps it after a reload', async () => {
    const storage = new FakeStorage();
    const store = emptyStore(storage);

    const res = await store.addFiles('entity', [file('entity.txt', 'ai supplychain\nnew york\n')]);

    expect(res).toMatchObject({ ok: true, name: 'entity.txt', count: 2, replaced: false });
    const reloaded = createStore(storage);
    expect(reloaded.list('entity')[0]).toMatchObject({ name: 'entity.txt', enabled: true, entries: ['ai supplychain', 'new york'] });
  });

  it('R1.2 does not save a file with a bad line', async () => {
    const store = emptyStore();

    const res = await store.addFiles('protected', [file('p.txt', 'iphone\nrunning shoes\n')]);

    expect(res.ok).toBe(false);
    expect(res.errors).toEqual([
      { line: 2, msg: '"running shoes" has a space. A protected word must be one word. Put phrases in Entities.' },
    ]);
    expect(store.list('protected')).toEqual([]);
  });

  it('R1.5 refuses a wrong extension, an empty file, a big file and a file that is not text', async () => {
    const store = emptyStore();

    expect((await store.addFiles('synonym', [file('s.csv', 'a, b')])).errors[0].msg).toBe(
      's.csv: this list needs a .txt file.',
    );
    expect((await store.addFiles('synonym', [file('s.txt', '')])).errors[0].msg).toBe('s.txt is empty.');
    expect((await store.addFiles('synonym', [file('s.txt', 'a, b\n'.repeat(300_000))])).errors[0].msg).toBe(
      'The file is 1.4 MB. The limit is 1.0 MB. Split it into smaller files.',
    );
    expect((await store.addFiles('synonym', [file('s.txt', 'a, b\u0000')])).errors[0].msg).toBe(
      's.txt does not look like a text file. Save it as UTF-8 text and try again.',
    );
    expect(store.list('synonym')).toEqual([]);
  });

  it('R1.6 replaces a file with the same name and keeps its on/off setting', async () => {
    const store = emptyStore();
    const first = await store.addFiles('entity', [file('entity.txt', 'ai supplychain\n')]);
    store.toggle(first.id!);

    const second = await store.addFiles('entity', [file('entity.txt', 'new york\ndata lake\n')]);

    expect(second).toMatchObject({ ok: true, replaced: true, id: first.id, count: 2 });
    expect(store.list('entity')).toHaveLength(1);
    expect(store.list('entity')[0].enabled).toBe(false);
  });

  it('R1.7 saves a Hunspell pair under the language name', async () => {
    const store = emptyStore();

    const res = await store.addFiles('hunspell', [file('en_GB.aff', 'SET UTF-8\n'), file('en_GB.dic', '2\nrun/S\nshoe\n')]);

    expect(res).toMatchObject({ ok: true, name: 'en_GB', count: 2 });
  });

  it('R2.3 turns a file off and on; off files are not used', async () => {
    const store = emptyStore();
    const { id } = await store.addFiles('entity', [file('e.txt', 'new york\n')]);

    expect(store.toggle(id!)).toBeNull();
    expect(store.list('entity')[0].enabled).toBe(false);
    expect(store.enabledEntries('entity')).toEqual([]);

    store.toggle(id!);
    expect(store.enabledEntries('entity')).toEqual(['new york']);
  });

  it('R2.4 removes a file', async () => {
    const store = emptyStore();
    const { id } = await store.addFiles('entity', [file('e.txt', 'new york\n')]);

    expect(store.remove(id!)).toBeNull();
    expect(store.list('entity')).toEqual([]);
    expect(store.remove(id!)).toBe('This file is gone. Reload the page.');
  });

  it('R2.6 adds an entry at the top after checking it; refuses bad and duplicate entries', async () => {
    const store = emptyStore();
    const { id } = await store.addFiles('entity', [file('e.txt', 'new york\n')]);

    expect(store.addEntry(id!, 'Data   Lake')).toBeNull();
    expect(store.list('entity')[0].entries).toEqual(['data lake', 'new york']);
    expect(store.addEntry(id!, 'ai')).toBe(
      '"ai" is one word. An entity needs two or more words. Put single words in Protected words.',
    );
    expect(store.addEntry(id!, 'data lake')).toBe('"data lake" is already in e.txt.');
    expect(store.addEntry(id!, '  ')).toBe('Type something first.');
  });

  it('R2.7 removes an entry but never the last one', async () => {
    const store = emptyStore();
    const { id } = await store.addFiles('entity', [file('e.txt', 'new york\ndata lake\n')]);

    expect(store.removeEntry(id!, 'new york')).toBeNull();
    expect(store.list('entity')[0].entries).toEqual(['data lake']);
    expect(store.removeEntry(id!, 'data lake')).toBe('This is the last entry. Remove the whole file instead.');
  });

  it('R2.8 Hunspell words cannot be added one by one', async () => {
    const store = createStore(new FakeStorage());
    const hun = store.list('hunspell')[0];

    expect(store.addEntry(hun.id, 'walk')).toBe(
      'Hunspell words come from the .dic file. Change the file and add it again.',
    );
  });

  it('R2.9 reset deletes all lists and loads the samples again', async () => {
    const store = emptyStore();
    await store.addFiles('entity', [file('mine.txt', 'new york\n')]);

    store.reset();

    expect(store.list('entity').map((f) => f.name)).toEqual(['entity.txt', 'brands-2026.txt']);
  });

  it('R4.2 reports the storage used', async () => {
    const storage = new FakeStorage();
    const store = emptyStore(storage);

    expect(store.used()).toBe((STORAGE_KEY.length + storage.getItem(STORAGE_KEY)!.length) * 2);
  });

  it('R4.3 does not save when storage is full, and keeps the old data', async () => {
    const storage = new FakeStorage(200);
    const store = emptyStore(storage);

    const res = await store.addFiles('entity', [file('big.txt', 'machine learning\n'.repeat(1) + 'large language model\n'.repeat(1) + 'supply chain management\nnew york\ndata lake\ncloud native\n')]);

    expect(res.ok).toBe(false);
    expect(res.errors[0].msg).toMatch(/^Storage is full\. Saving needs about \d+ KB, and the browser allows about 5\.0 MB\. Remove a list and try again\.$/);
    expect(store.list('entity')).toEqual([]);
  });

  it('tells listeners about each change', async () => {
    const store = emptyStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const { id } = await store.addFiles('entity', [file('e.txt', 'new york\n')]);
    store.toggle(id!);
    store.remove(id!);

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
