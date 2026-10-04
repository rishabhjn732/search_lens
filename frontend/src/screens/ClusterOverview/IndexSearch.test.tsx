import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IndexSearch from './IndexSearch';
import type { IndexSummary } from '../../opensearch/overview';

const INDEXES: IndexSummary[] = [
  { name: 'products_v7', health: 'green', docsCount: 1, sizeBytes: 1, isSystem: false },
  { name: '.kibana_1', health: 'green', docsCount: 1, sizeBytes: 1, isSystem: true },
];

describe('IndexSearch', () => {
  it('shows nothing before the user types', () => {
    render(<IndexSearch indexes={INDEXES} onOpenIndex={vi.fn()} />);
    expect(screen.queryByText('products_v7')).not.toBeInTheDocument();
  });

  it('filters all names, including system indexes, as the user types', () => {
    render(<IndexSearch indexes={INDEXES} onOpenIndex={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Find an index by name'), { target: { value: 'kiba' } });
    expect(screen.getByText('.kibana_1')).toBeInTheDocument();
    expect(screen.queryByText('products_v7')).not.toBeInTheDocument();
  });

  it('shows a no-match message for text that matches nothing', () => {
    render(<IndexSearch indexes={INDEXES} onOpenIndex={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Find an index by name'), { target: { value: 'zzz' } });
    expect(screen.getByText("No index matches 'zzz'.")).toBeInTheDocument();
  });

  it('calls onOpenIndex when a result is chosen, and closes the result list', () => {
    const onOpenIndex = vi.fn();
    render(<IndexSearch indexes={INDEXES} onOpenIndex={onOpenIndex} />);
    fireEvent.change(screen.getByLabelText('Find an index by name'), { target: { value: 'products' } });
    fireEvent.click(screen.getByText('products_v7'));

    expect(onOpenIndex).toHaveBeenCalledWith('products_v7');
    expect(screen.queryByText('products_v7')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('closes the result list after a substring match is chosen (gpc -> gartner-gpc-discussions)', () => {
    const onOpenIndex = vi.fn();
    const indexes: IndexSummary[] = [
      { name: 'gartner-gpc-discussions', health: 'green', docsCount: 1, sizeBytes: 1, isSystem: false },
      { name: 'other-index', health: 'green', docsCount: 1, sizeBytes: 1, isSystem: false },
    ];
    render(<IndexSearch indexes={indexes} onOpenIndex={onOpenIndex} />);
    fireEvent.change(screen.getByLabelText('Find an index by name'), { target: { value: 'gpc' } });
    expect(screen.getByText('gartner-gpc-discussions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('gartner-gpc-discussions'));

    expect(onOpenIndex).toHaveBeenCalledWith('gartner-gpc-discussions');
    expect(screen.queryByText('gartner-gpc-discussions')).not.toBeInTheDocument();
  });
});
