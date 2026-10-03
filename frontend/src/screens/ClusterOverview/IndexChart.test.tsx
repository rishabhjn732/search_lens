import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IndexChart from './IndexChart';
import type { IndexSummary } from '../../opensearch/overview';

const INDEXES: IndexSummary[] = [
  { name: 'small_docs', health: 'green', docsCount: 9000, sizeBytes: 100, isSystem: false },
  { name: 'big_size', health: 'yellow', docsCount: 10, sizeBytes: 900000, isSystem: false },
  { name: '.system_one', health: 'green', docsCount: 1, sizeBytes: 1, isSystem: true },
];

describe('IndexChart', () => {
  it('sorts by size by default and shows the system-index count', () => {
    render(<IndexChart indexes={INDEXES} onOpenIndex={vi.fn()} />);
    const labels = screen.getAllByText(/_size$|_docs$/).map((el) => el.textContent);
    expect(labels[0]).toBe('big_size');
    expect(screen.getByText(/1 system index not shown/)).toBeInTheDocument();
  });

  it('switches to sort by documents', () => {
    render(<IndexChart indexes={INDEXES} onOpenIndex={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'docs' } });
    const labels = screen.getAllByText(/_size$|_docs$/).map((el) => el.textContent);
    expect(labels[0]).toBe('small_docs');
  });

  it('calls onOpenIndex when a bar is chosen', () => {
    const onOpenIndex = vi.fn();
    render(<IndexChart indexes={INDEXES} onOpenIndex={onOpenIndex} />);
    fireEvent.click(screen.getByText('big_size'));
    expect(onOpenIndex).toHaveBeenCalledWith('big_size');
  });

  it('shows the empty message for a cluster with no indexes', () => {
    render(<IndexChart indexes={[]} onOpenIndex={vi.fn()} />);
    expect(screen.getByText('This cluster has no indexes yet.')).toBeInTheDocument();
  });
});
