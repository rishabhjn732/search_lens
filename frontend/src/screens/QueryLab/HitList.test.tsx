import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HitList from './HitList';
import type { QueryLabResult } from '../../opensearch/querylab';

describe('HitList', () => {
  it('shows the empty message when there are no hits', () => {
    const result: QueryLabResult = { total: 0, hits: [] };
    render(<HitList result={result} selectedId={null} explainWasOn={true} queryFields={[]} onSelect={vi.fn()} />);

    expect(screen.getByText('No documents matched this query.')).toBeInTheDocument();
  });

  it('shows the total and a row per hit, and calls onSelect', () => {
    const result: QueryLabResult = {
      total: 42,
      hits: [
        { id: '1', score: 3.2, source: {}, explanation: { value: 3.2, description: 'sum of:', details: [] } },
        { id: '2', score: 1.1, source: {}, explanation: null },
      ],
    };
    const onSelect = vi.fn();
    render(<HitList result={result} selectedId={null} explainWasOn={true} queryFields={[]} onSelect={onSelect} />);

    expect(screen.getByText(/42 documents matched/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('1').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('expands the score panel inline for the selected hit', () => {
    const result: QueryLabResult = {
      total: 1,
      hits: [{ id: '1', score: 1, source: {}, explanation: { value: 1, description: 'sum of:', details: [] } }],
    };
    render(<HitList result={result} selectedId="1" explainWasOn={true} queryFields={[]} onSelect={vi.fn()} />);

    expect(screen.getByText('1').closest('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Score for document 1')).toBeInTheDocument();
  });

  it('clicking the open hit again collapses it (passes null to onSelect)', () => {
    const result: QueryLabResult = {
      total: 1,
      hits: [{ id: '1', score: 1, source: {}, explanation: { value: 1, description: 'sum of:', details: [] } }],
    };
    const onSelect = vi.fn();
    render(<HitList result={result} selectedId="1" explainWasOn={true} queryFields={[]} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('1').closest('button')!);

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows a note instead of the panel when Explain was off', () => {
    const result: QueryLabResult = {
      total: 1,
      hits: [{ id: '1', score: 1, source: {}, explanation: null }],
    };
    render(<HitList result={result} selectedId="1" explainWasOn={false} queryFields={[]} onSelect={vi.fn()} />);

    expect(screen.getByText(/Turn Explain on/)).toBeInTheDocument();
  });
});
