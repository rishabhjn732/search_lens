// Runs analysis for the Mapping lab (spec 007, R4.1 to R4.3).
// It sits between the screen and a source of analysis (the browser copy, or the cluster):
// at most `parallel` calls are open at once, the same steps and text are asked once, and
// cancel() throws away everything that is still waiting or open.
import type { AnalyzeResponse, Chain } from '../../analysis/types';

export type Source = (chain: Chain, text: string, signal: AbortSignal) => Promise<AnalyzeResponse>;

export type Outcome =
  | { status: 'pending' }
  | { status: 'done'; response: AnalyzeResponse }
  | { status: 'error'; error: unknown };

export interface Progress {
  done: number;
  total: number;
}

export interface Runner {
  // The answer for these steps and this text. Asks the source once; later calls share the answer.
  get(chain: Chain, text: string): Promise<AnalyzeResponse>;
  // What is known right now, or undefined when this was never asked. Does not start anything.
  lookup(chain: Chain, text: string): Outcome | undefined;
  progress(): Progress;
  // Calls the listener whenever an answer arrives. Returns a function that stops listening.
  subscribe(listener: () => void): () => void;
  // Stops open calls, forgets the queue, and makes waiting get() calls fail with a cancel error.
  cancel(): void;
}

export class CancelledError extends Error {
  constructor() {
    super('The run was cancelled.');
    this.name = 'CancelledError';
  }
}

export function isCancelled(e: unknown): boolean {
  return e instanceof CancelledError;
}

// Two chains with the same steps (type and settings) and the same text share one answer.
// Step names are left out on purpose: the screen shows the names from the definition (design).
// The steps part of the key is built once for each chain, because the screen asks very often.
const stepsKeys = new WeakMap<Chain, string>();

export function analysisKey(chain: Chain, text: string): string {
  let steps = stepsKeys.get(chain);
  if (steps === undefined) {
    steps = JSON.stringify([chain.charFilters.map((s) => s.def), chain.tokenizer.def, chain.filters.map((s) => s.def)]);
    stepsKeys.set(chain, steps);
  }
  return `${steps}|${JSON.stringify(text)}`;
}

interface Entry {
  chain: Chain;
  text: string;
  outcome: Outcome;
  promise: Promise<AnalyzeResponse>;
  resolve: (r: AnalyzeResponse) => void;
  reject: (e: unknown) => void;
}

export function createRunner(source: Source, options: { parallel?: number } = {}): Runner {
  const parallel = Math.max(1, options.parallel ?? 4);
  const entries = new Map<string, Entry>();
  const queue: string[] = [];
  const open = new Set<AbortController>();
  const listeners = new Set<() => void>();
  let active = 0;
  let done = 0;
  let cancelled = false;

  const notify = () => listeners.forEach((l) => l());

  function start(key: string) {
    const entry = entries.get(key)!;
    const controller = new AbortController();
    open.add(controller);
    active++;
    Promise.resolve()
      .then(() => source(entry.chain, entry.text, controller.signal))
      .then(
        (response) => {
          if (cancelled) return;
          entry.outcome = { status: 'done', response };
          done++;
          entry.resolve(response);
        },
        (error) => {
          if (cancelled) return;
          entry.outcome = { status: 'error', error };
          done++;
          entry.reject(error);
        },
      )
      .finally(() => {
        open.delete(controller);
        active--;
        if (!cancelled) {
          pump();
          notify();
        }
      });
  }

  function pump() {
    while (active < parallel && queue.length) start(queue.shift()!);
  }

  return {
    get(chain, text) {
      if (cancelled) return Promise.reject(new CancelledError());
      const key = analysisKey(chain, text);
      const known = entries.get(key);
      if (known) return known.promise;
      let resolve!: Entry['resolve'];
      let reject!: Entry['reject'];
      const promise = new Promise<AnalyzeResponse>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // The caller may ignore a failure and read it with lookup() instead; that is not an error.
      promise.catch(() => {});
      entries.set(key, { chain, text, outcome: { status: 'pending' }, promise, resolve, reject });
      queue.push(key);
      pump();
      return promise;
    },
    lookup(chain, text) {
      return entries.get(analysisKey(chain, text))?.outcome;
    },
    progress: () => ({ done, total: entries.size }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      queue.length = 0;
      open.forEach((c) => c.abort());
      entries.forEach((e) => {
        if (e.outcome.status === 'pending') e.reject(new CancelledError());
      });
      listeners.clear();
    },
  };
}
