import { useSyncExternalStore } from 'react';
import type { WordListStore } from './store';
import { createStore } from './store';

let shared: WordListStore | null = null;

// One store for the whole page, on this browser's localStorage.
export function wordListStore(): WordListStore {
  shared ??= createStore(window.localStorage);
  return shared;
}

// For tests: start again with a new store.
export function resetWordListStoreForTests(store?: WordListStore) {
  shared = store ?? null;
}

// Redraws the calling component after any change to the lists.
export function useWordLists(): WordListStore {
  const store = wordListStore();
  useSyncExternalStore(store.subscribe, store.version);
  return store;
}
