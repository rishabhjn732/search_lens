import { useSyncExternalStore } from 'react';
import { createLabStore, type LabStore } from './labStore';

let shared: LabStore | null = null;

// One store for the whole page, on this browser's localStorage.
export function labStore(): LabStore {
  shared ??= createLabStore(window.localStorage);
  return shared;
}

// For tests: start again with a new store.
export function resetLabStoreForTests(store?: LabStore) {
  shared = store ?? null;
}

// Redraws the calling component after any change to the saved lab data.
export function useLabStore(): LabStore {
  const store = labStore();
  useSyncExternalStore(store.subscribe, store.version);
  return store;
}
