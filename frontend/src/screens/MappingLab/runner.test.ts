import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeResponse, Chain, Step } from '../../analysis/types';
import { CancelledError, analysisKey, createRunner, isCancelled } from './runner';

const step = (name: string, type = name, extra: object = {}): Step => ({ name, def: { type, ...extra }, known: true });
const chain = (filters: Step[] = [], name = 'c'): Chain => ({ name, charFilters: [], tokenizer: step('standard'), filters });
const response = (text: string): AnalyzeResponse => ({
  detail: { custom_analyzer: true, charfilters: [], tokenizer: { name: 'standard', tokens: [] }, tokenfilters: [{ name: text, tokens: [] }] },
});

// A source that answers only when the test says so, and counts how many calls are open.
function fakeSource() {
  const calls: { text: string; signal: AbortSignal; ok: () => void; fail: (e: unknown) => void }[] = [];
  let open = 0;
  let mostOpen = 0;
  const source = (_c: Chain, text: string, signal: AbortSignal) =>
    new Promise<AnalyzeResponse>((resolve, reject) => {
      open++;
      mostOpen = Math.max(mostOpen, open);
      const end = () => (open -= 1);
      calls.push({
        text,
        signal,
        ok: () => (end(), resolve(response(text))),
        fail: (e) => (end(), reject(e)),
      });
    });
  return { source, calls, mostOpen: () => mostOpen, open: () => open };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('createRunner: at most 4 open at once (R4.1)', () => {
  it('starts 4 calls, keeps the rest waiting, and starts the next as each one ends', async () => {
    const f = fakeSource();
    const runner = createRunner(f.source, { parallel: 4 });
    const c = chain();
    const answers = Array.from({ length: 10 }, (_, i) => runner.get(c, `text ${i}`));
    await tick();
    expect(f.calls.map((x) => x.text)).toEqual(['text 0', 'text 1', 'text 2', 'text 3']);
    expect(runner.progress()).toEqual({ done: 0, total: 10 });

    f.calls[0].ok();
    await tick();
    expect(f.calls).toHaveLength(5);
    expect(f.calls[4].text).toBe('text 4');

    while (runner.progress().done < 10) {
      f.calls.filter((x) => x.signal.aborted === false).forEach((x) => x.ok());
      await tick();
    }
    await Promise.all(answers);
    expect(f.mostOpen()).toBe(4);
    expect(f.calls).toHaveLength(10);
  });

  it('uses 4 by default', async () => {
    const f = fakeSource();
    const runner = createRunner(f.source);
    for (let i = 0; i < 6; i++) void runner.get(chain(), `t${i}`);
    await tick();
    expect(f.open()).toBe(4);
  });
});

describe('createRunner: the same steps and text are asked once (R4.3)', () => {
  it('shares one call between two get() calls, and between chains with the same steps', async () => {
    const source = vi.fn(async (_c: Chain, text: string) => response(text));
    const runner = createRunner(source);
    const a = chain([step('lowercase')], 'title');
    const b = chain([step('lowercase')], 'description'); // other chain name, same steps
    const first = await runner.get(a, 'Running Shoes');
    expect(await runner.get(a, 'Running Shoes')).toBe(first);
    expect(await runner.get(b, 'Running Shoes')).toBe(first);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('asks again for another text, other steps, or other settings of a step', async () => {
    const source = vi.fn(async (_c: Chain, text: string) => response(text));
    const runner = createRunner(source);
    await runner.get(chain([step('lowercase')]), 'a');
    await runner.get(chain([step('lowercase')]), 'b');
    await runner.get(chain([step('stemmer', 'stemmer', { language: 'english' })]), 'a');
    await runner.get(chain([step('stemmer', 'stemmer', { language: 'light_english' })]), 'a');
    expect(source).toHaveBeenCalledTimes(4);
  });

  it('builds the key from the type and settings of the steps, not their names', () => {
    expect(analysisKey(chain([step('my_lower', 'lowercase')]), 'x')).toBe(analysisKey(chain([step('lowercase')]), 'x'));
    expect(analysisKey(chain([step('lowercase')]), 'x')).not.toBe(analysisKey(chain([step('uppercase')]), 'x'));
  });
});

describe('createRunner: progress and results (R4.1)', () => {
  it('tells listeners when an answer arrives, and lets the screen look at what is known', async () => {
    const f = fakeSource();
    const runner = createRunner(f.source);
    const heard = vi.fn();
    const stop = runner.subscribe(heard);
    const c = chain();
    expect(runner.lookup(c, 'a')).toBeUndefined();
    const p = runner.get(c, 'a');
    void runner.get(c, 'b');
    expect(runner.lookup(c, 'a')).toEqual({ status: 'pending' });
    await tick();

    f.calls[0].ok();
    await p;
    await tick();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(runner.lookup(c, 'a')).toEqual({ status: 'done', response: response('a') });
    expect(runner.progress()).toEqual({ done: 1, total: 2 });

    stop();
    f.calls[1].ok();
    await tick();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(runner.progress()).toEqual({ done: 2, total: 2 });
  });

  it('keeps a failure for that one analysis, and the others go on', async () => {
    const f = fakeSource();
    const runner = createRunner(f.source);
    const c = chain();
    const bad = runner.get(c, 'bad');
    const good = runner.get(c, 'good');
    await tick();
    const boom = new Error('unknown filter type [foo]');
    f.calls[0].fail(boom);
    f.calls[1].ok();
    await expect(bad).rejects.toBe(boom);
    await good;
    expect(runner.lookup(c, 'bad')).toEqual({ status: 'error', error: boom });
    expect(runner.lookup(c, 'good')?.status).toBe('done');
    expect(runner.progress()).toEqual({ done: 2, total: 2 });
  });

  it('does not report an unhandled error when the screen only reads lookup()', async () => {
    const runner = createRunner(async () => {
      throw new Error('nope');
    });
    void runner.get(chain(), 'a');
    await tick();
    expect(runner.lookup(chain(), 'a')?.status).toBe('error');
  });
});

describe('createRunner: cancel() (R4.2)', () => {
  it('aborts open calls, empties the queue, and drops late answers', async () => {
    const f = fakeSource();
    const runner = createRunner(f.source, { parallel: 2 });
    const heard = vi.fn();
    runner.subscribe(heard);
    const c = chain();
    const results = ['a', 'b', 'c', 'd'].map((t) => runner.get(c, t));
    await tick();
    expect(f.calls).toHaveLength(2);

    runner.cancel();
    expect(f.calls.every((x) => x.signal.aborted)).toBe(true);
    for (const r of results) await expect(r).rejects.toBeInstanceOf(CancelledError);

    f.calls[0].ok(); // a late answer
    await tick();
    expect(f.calls).toHaveLength(2); // the queued ones never started
    expect(runner.progress().done).toBe(0);
    expect(heard).not.toHaveBeenCalled();
    expect(runner.lookup(c, 'a')).toEqual({ status: 'pending' });
  });

  it('makes later get() calls fail, and can be called twice', async () => {
    const runner = createRunner(async () => response('x'));
    runner.cancel();
    runner.cancel();
    const err = await runner.get(chain(), 'a').catch((e) => e);
    expect(isCancelled(err)).toBe(true);
    expect(isCancelled(new Error('other'))).toBe(false);
  });

  it('keeps answers that were already done', async () => {
    const runner = createRunner(async (_c, text) => response(text));
    const c = chain();
    await runner.get(c, 'a');
    runner.cancel();
    expect(runner.lookup(c, 'a')?.status).toBe('done');
  });
});
