import { describe, expect, it, vi } from 'vitest';
import { LAB_STORAGE_KEY, MAX_OWN_TESTS, OWN_TESTS_FULL, OWN_TEST_EMPTY, createLabStore } from './labStore';

// A storage that works like the browser's, and can be told to run out of space.
function memoryStorage(limit = Infinity): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (k.length + v.length > limit) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
  };
}

describe('labStore: the pasted definition (R1.8)', () => {
  it('has nothing saved at first', () => {
    const store = createLabStore(memoryStorage());
    expect(store.definitionText()).toBeNull();
    expect(store.ownTests()).toEqual([]);
  });

  it('is read back by a new store on the same storage, like after a reload', () => {
    const storage = memoryStorage();
    expect(createLabStore(storage).saveDefinition('{"mappings": {}}')).toBeNull();
    expect(createLabStore(storage).definitionText()).toBe('{"mappings": {}}');
  });

  it('keeps an empty text, so Clear is remembered', () => {
    const storage = memoryStorage();
    createLabStore(storage).saveDefinition('');
    expect(createLabStore(storage).definitionText()).toBe('');
  });

  it('keeps the own tests when the definition is saved', () => {
    const store = createLabStore(memoryStorage());
    store.addOwnTest('Nike Pegasus', 'pegasus');
    store.saveDefinition('{}');
    expect(store.ownTests()).toEqual([['Nike Pegasus', 'pegasus']]);
  });

  it('starts again with nothing when the saved data is broken', () => {
    const storage = memoryStorage();
    storage.setItem(LAB_STORAGE_KEY, '{not json');
    expect(createLabStore(storage).definitionText()).toBeNull();
    storage.setItem(LAB_STORAGE_KEY, JSON.stringify({ definition: 5, ownTests: ['x', ['a', 'b'], [1, 2]] }));
    const store = createLabStore(storage);
    expect(store.definitionText()).toBeNull();
    expect(store.ownTests()).toEqual([['a', 'b']]);
  });
});

describe('labStore: own tests (R3.11)', () => {
  it('adds a test (trimmed), keeps it after a reload, and removes it', () => {
    const storage = memoryStorage();
    const store = createLabStore(storage);
    expect(store.addOwnTest('  Nike Air Zoom  ', ' pegasus ')).toBeNull();
    expect(store.addOwnTest('Adidas Samba', 'samba')).toBeNull();
    expect(createLabStore(storage).ownTests()).toEqual([['Nike Air Zoom', 'pegasus'], ['Adidas Samba', 'samba']]);
    expect(store.removeOwnTest(0)).toBeNull();
    expect(createLabStore(storage).ownTests()).toEqual([['Adidas Samba', 'samba']]);
  });

  it('asks for both texts', () => {
    const store = createLabStore(memoryStorage());
    expect(store.addOwnTest('', 'x')).toBe(OWN_TEST_EMPTY);
    expect(store.addOwnTest('x', '   ')).toBe(OWN_TEST_EMPTY);
    expect(store.ownTests()).toEqual([]);
  });

  it('allows 200 own tests and then says so', () => {
    const store = createLabStore(memoryStorage());
    for (let i = 0; i < MAX_OWN_TESTS; i++) expect(store.addOwnTest(`saved ${i}`, `typed ${i}`)).toBeNull();
    expect(OWN_TESTS_FULL).toBe('You have 200 own tests, the most allowed. Remove one to add another.');
    expect(store.addOwnTest('one more', 'one more')).toBe(OWN_TESTS_FULL);
    expect(store.ownTests()).toHaveLength(200);
    expect(store.removeOwnTest(0)).toBeNull();
    expect(store.addOwnTest('one more', 'one more')).toBeNull();
  });

  it('refuses to remove a test that is not there', () => {
    const store = createLabStore(memoryStorage());
    expect(store.removeOwnTest(0)).toBe('This test is gone. Reload the page.');
    expect(store.removeOwnTest(-1)).toBe('This test is gone. Reload the page.');
  });
});

describe('labStore: storage full (same sentence as the word lists)', () => {
  it('says so, saves nothing, and keeps what was there', () => {
    const storage = memoryStorage(150);
    const store = createLabStore(storage);
    expect(store.addOwnTest('small', 'test')).toBeNull();
    const err = store.saveDefinition('x'.repeat(500));
    expect(err).toMatch(/^Storage is full\. Saving needs about \d+ KB, and the browser allows about 5\.0 MB\. Remove a list and try again\.$/);
    expect(store.definitionText()).toBeNull();
    expect(store.ownTests()).toEqual([['small', 'test']]);
    expect(createLabStore(storage).ownTests()).toEqual([['small', 'test']]);
  });

  it('refuses an own test when storage is full', () => {
    const store = createLabStore(memoryStorage(60));
    expect(store.addOwnTest('a'.repeat(100), 'b')).toMatch(/^Storage is full\./);
    expect(store.ownTests()).toEqual([]);
  });
});

describe('labStore: listeners', () => {
  it('tells listeners after each saved change, and not after a failed one', () => {
    const store = createLabStore(memoryStorage(80));
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    const v0 = store.version();
    store.addOwnTest('a', 'b');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.version()).toBe(v0 + 1);
    store.saveDefinition('x'.repeat(200)); // too big, not saved
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    store.addOwnTest('c', 'd');
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
