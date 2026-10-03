// What the Mapping lab keeps in this browser (spec 007, R1.8, R3.11): the last pasted definition
// and the user's own tests. Both are plain text, not secret. No network.
import { QUOTA, formatSize } from '../../wordlists/store';

export const LAB_STORAGE_KEY = 'searchlens.mappinglab.v1';
export const MAX_OWN_TESTS = 200;

export type OwnTest = [saved: string, typed: string];

interface Saved {
  definition: string | null;
  ownTests: OwnTest[];
}

export const OWN_TESTS_FULL = `You have ${MAX_OWN_TESTS} own tests, the most allowed. Remove one to add another.`;
export const OWN_TEST_EMPTY = 'Type both texts first: the text saved in the index, and what the shopper types.';

export type LabStore = ReturnType<typeof createLabStore>;

// One value for "nothing saved", so lists taken from it keep the same identity between calls.
const NOTHING: Saved = { definition: null, ownTests: [] };

const isOwnTest = (t: unknown): t is OwnTest =>
  Array.isArray(t) && t.length === 2 && typeof t[0] === 'string' && typeof t[1] === 'string';

export function createLabStore(storage: Storage) {
  let cache: { raw: string; data: Saved } | null = null;
  let version = 0;
  const listeners = new Set<() => void>();

  function load(): Saved {
    const raw = storage.getItem(LAB_STORAGE_KEY);
    if (raw && cache?.raw === raw) return cache.data;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Saved>;
        const data: Saved = {
          definition: typeof parsed.definition === 'string' ? parsed.definition : null,
          ownTests: Array.isArray(parsed.ownTests) ? parsed.ownTests.filter(isOwnTest) : [],
        };
        cache = { raw, data };
        return data;
      } catch {
        // Broken data: start again with nothing saved.
      }
    }
    return NOTHING;
  }

  // Returns an error sentence, or null when saved. The same sentence as the word lists (spec 006 R4.3).
  function save(data: Saved): string | null {
    const json = JSON.stringify(data);
    try {
      storage.setItem(LAB_STORAGE_KEY, json);
      cache = { raw: json, data };
      version += 1;
      listeners.forEach((l) => l());
      return null;
    } catch {
      const need = (LAB_STORAGE_KEY.length + json.length) * 2;
      return `Storage is full. Saving needs about ${formatSize(need)}, and the browser allows about ${formatSize(QUOTA)}. Remove a list and try again.`;
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    // null when nothing was pasted yet (the screen then shows the "Online shop" example).
    definitionText: () => load().definition,
    saveDefinition: (text: string) => save({ ...load(), definition: text }),
    ownTests: () => load().ownTests,
    addOwnTest(saved: string, typed: string): string | null {
      const a = saved.trim();
      const b = typed.trim();
      if (!a || !b) return OWN_TEST_EMPTY;
      const data = load();
      if (data.ownTests.length >= MAX_OWN_TESTS) return OWN_TESTS_FULL;
      return save({ ...data, ownTests: [...data.ownTests, [a, b]] });
    },
    removeOwnTest(index: number): string | null {
      const data = load();
      if (index < 0 || index >= data.ownTests.length) return 'This test is gone. Reload the page.';
      return save({ ...data, ownTests: data.ownTests.filter((_, i) => i !== index) });
    },
  };
}
