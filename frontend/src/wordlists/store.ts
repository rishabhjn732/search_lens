// Saved word lists in browser storage. No network calls (R4.4).
import type { ListType, ParseResult, Problem, TextFile } from './rules';
import { TYPES, checkLine, normaliseFor, parseHunspell, parseList } from './rules';
import type { SavedData, SavedFile } from './samples';
import { sampleData } from './samples';

export const STORAGE_KEY = 'searchlens.wordlists.v1';
export const QUOTA = 5 * 1024 * 1024; // about 5 MB, browsers differ
const MAX_LIST = 1024 * 1024; // 1 MB per list file
const MAX_HUNSPELL = 4 * 1024 * 1024; // 4 MB for .aff + .dic together

export function formatSize(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// FileReader works in every browser and in the test browser (jsdom).
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export interface AddResult {
  ok: boolean;
  name: string;
  id?: string;
  replaced?: boolean;
  count?: number;
  errors: Problem[];
  warnings: Problem[];
}

export type WordListStore = ReturnType<typeof createStore>;

export function createStore(storage: Storage, now: () => number = Date.now) {
  let cache: { raw: string; data: SavedData } | null = null;
  let version = 0;
  const listeners = new Set<() => void>();

  function uid(): string {
    return `f${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function changed() {
    version += 1;
    listeners.forEach((l) => l());
  }

  function load(): SavedData {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw && cache?.raw === raw) return cache.data;
    if (raw) {
      try {
        const data = JSON.parse(raw) as SavedData;
        if (Array.isArray(data.files)) {
          cache = { raw, data };
          return data;
        }
      } catch {
        // Broken data: start again with the samples.
      }
    }
    const data = sampleData(now(), uid);
    trySave(data);
    return data;
  }

  // Returns an error sentence, or null when saved.
  function trySave(data: SavedData): string | null {
    const json = JSON.stringify(data);
    try {
      storage.setItem(STORAGE_KEY, json);
      cache = { raw: json, data };
      return null;
    } catch {
      const need = (STORAGE_KEY.length + json.length) * 2;
      return `Storage is full. Saving needs about ${formatSize(need)}, and the browser allows about ${formatSize(QUOTA)}. Remove a list and try again.`;
    }
  }

  // Runs a change on a copy, so a failed save leaves the saved data as it was.
  function change(id: string, fn: (f: SavedFile, data: SavedData) => string | void): string | null {
    const data = structuredClone(load());
    const f = data.files.find((x) => x.id === id);
    if (!f) return 'This file is gone. Reload the page.';
    const msg = fn(f, data);
    if (msg) return msg;
    const err = trySave(data);
    if (!err) changed();
    return err;
  }

  async function addFiles(type: ListType, input: FileList | File[]): Promise<AddResult> {
    const files = Array.from(input);
    const names = files.map((f) => f.name).join(' + ');
    const fail = (errors: Problem[], warnings: Problem[] = []): AddResult => ({ ok: false, name: names, errors, warnings });

    if (type !== 'hunspell' && files.length !== 1) return fail([{ line: 0, msg: 'Choose one file at a time.' }]);
    const accept = TYPES[type].accept;
    const limit = type === 'hunspell' ? MAX_HUNSPELL : MAX_LIST;
    const problems: Problem[] = [];
    let total = 0;
    for (const f of files) {
      total += f.size;
      if (!accept.some((a) => f.name.toLowerCase().endsWith(a)))
        problems.push({ line: 0, msg: `${f.name}: this list needs a ${accept.join(' or ')} file.` });
      else if (f.size === 0) problems.push({ line: 0, msg: `${f.name} is empty.` });
    }
    if (!problems.length && total > limit)
      problems.push({
        line: 0,
        msg: `The file is ${formatSize(total)}. The limit is ${formatSize(limit)}. Split it into smaller files.`,
      });
    if (problems.length) return fail(problems);

    let texts: TextFile[];
    try {
      texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await readText(f) })));
    } catch {
      return fail([{ line: 0, msg: 'The browser could not read the file. Try again.' }]);
    }
    const binary = texts.find((f) => /[\u0000�]/.test(f.text));
    if (binary)
      return fail([{ line: 0, msg: `${binary.name} does not look like a text file. Save it as UTF-8 text and try again.` }]);

    const res: ParseResult = type === 'hunspell' ? parseHunspell(texts) : parseList(type, texts[0].text);
    if (res.errors.length) return fail(res.errors, res.warnings);

    const name = type === 'hunspell' ? res.name! : texts[0].name;
    const data = structuredClone(load());
    const old = data.files.find((f) => f.type === type && f.name === name);
    const rec: SavedFile = {
      id: old ? old.id : uid(),
      type,
      name,
      enabled: old ? old.enabled : true,
      entries: res.entries,
      updated: now(),
    };
    if (old) data.files[data.files.indexOf(old)] = rec;
    else data.files.push(rec);
    const err = trySave(data);
    if (err) return fail([{ line: 0, msg: err }]);
    changed();
    return { ok: true, id: rec.id, name, replaced: !!old, count: rec.entries.length, errors: [], warnings: res.warnings };
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    list: (type: ListType) => load().files.filter((f) => f.type === type),
    enabledEntries: (type: ListType) =>
      load()
        .files.filter((f) => f.type === type && f.enabled)
        .flatMap((f) => f.entries),
    used: () => (STORAGE_KEY.length + (storage.getItem(STORAGE_KEY) ?? '').length) * 2,
    addFiles,
    remove: (id: string) =>
      change(id, (f, data) => {
        data.files.splice(data.files.indexOf(f), 1);
      }),
    toggle: (id: string) =>
      change(id, (f) => {
        f.enabled = !f.enabled;
      }),
    addEntry: (id: string, text: string) =>
      change(id, (f) => {
        if (f.type === 'hunspell') return 'Hunspell words come from the .dic file. Change the file and add it again.';
        if (!text.trim()) return 'Type something first.';
        const line = normaliseFor(f.type, text);
        const err = checkLine(f.type, line);
        if (err) return err;
        if (f.entries.includes(line)) return `"${line}" is already in ${f.name}.`;
        f.entries.unshift(line);
        f.updated = now();
      }),
    removeEntry: (id: string, entry: string) =>
      change(id, (f) => {
        const i = f.entries.indexOf(entry);
        if (i < 0) return `"${entry}" is not in ${f.name}.`;
        if (f.entries.length === 1) return 'This is the last entry. Remove the whole file instead.';
        f.entries.splice(i, 1);
        f.updated = now();
      }),
    reset() {
      storage.removeItem(STORAGE_KEY);
      cache = null;
      load();
      changed();
    },
  };
}
