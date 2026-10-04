import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveAnalyzer } from '../../analysis/definition';
import type { Field } from '../../analysis/types';
import FieldPlayground from './FieldPlayground';

const FIELD: Field = { path: 'title', type: 'text', kind: 'text', indexAnalyzer: 'standard' };

// A chain with two token filters so reordering is meaningful.
function chainWith(filterNames: string[]) {
  const settings = {
    analyzer: {
      mine: { type: 'custom', tokenizer: 'standard', filter: filterNames },
    },
  };
  const result = resolveAnalyzer('mine', settings);
  if ('error' in result) throw new Error('setup: chain should resolve');
  return result;
}

describe('FieldPlayground', () => {
  it('shows the tokenizer and per-filter tokens for the typed text (R9.1, R9.2)', () => {
    const chain = chainWith(['lowercase', 'reverse']);
    render(<FieldPlayground field={FIELD} chain={chain} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Text to try'), { target: { value: 'RUN' } });

    expect(screen.getByText('Tokenizer: standard')).toBeInTheDocument();
    // After lowercase: "run"; after reverse: "nur".
    expect(screen.getAllByText('run').length).toBeGreaterThan(0);
    expect(screen.getByText('nur')).toBeInTheDocument();
  });

  it('says plainly that it runs in the browser (R9.7)', () => {
    render(<FieldPlayground field={FIELD} chain={chainWith(['lowercase'])} onClose={vi.fn()} />);
    expect(
      screen.getByText(/These steps run in your browser/),
    ).toBeInTheDocument();
  });

  it('moving a filter changes the resulting tokens, with no network call (R9.3, R9.4)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const chain = chainWith(['reverse', 'uppercase']);
    render(<FieldPlayground field={FIELD} chain={chain} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Text to try'), { target: { value: 'run' } });
    // Order is reverse, then uppercase: "run" -> "nur" -> "NUR".
    expect(screen.getByText('NUR')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Move uppercase earlier' }));
    // Now uppercase, then reverse: "run" -> "RUN" -> "NUR" (same result, different path);
    // check the intermediate step instead, which does change.
    expect(screen.getByText('RUN')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('Reset restores the cluster order after a move (R9.5)', () => {
    const chain = chainWith(['reverse', 'uppercase']);
    render(<FieldPlayground field={FIELD} chain={chain} onClose={vi.fn()} />);
    const resetButton = screen.getByRole('button', { name: "Reset to the cluster's order" });
    expect(resetButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Move uppercase earlier' }));
    expect(resetButton).toBeEnabled();

    fireEvent.click(resetButton);
    expect(resetButton).toBeDisabled();
  });

  it('calls onClose when Close is chosen (R9.6)', () => {
    const onClose = vi.fn();
    render(<FieldPlayground field={FIELD} chain={chainWith(['lowercase'])} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
