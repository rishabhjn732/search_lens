import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WhyNotMatched from './WhyNotMatched';
import { ClusterError } from '../../opensearch/errors';

describe('WhyNotMatched', () => {
  it('shows the not-found message for an id that does not exist', async () => {
    const request = vi.fn().mockRejectedValue(new ClusterError('cluster_error', 'nope', { status: 404 }));
    render(<WhyNotMatched request={request} indexName="products" query={{ match_all: {} }} />);

    fireEvent.change(screen.getByLabelText('Document id'), { target: { value: 'missing-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => {
      expect(screen.getByText("No document with id 'missing-1' in this index.")).toBeInTheDocument();
    });
  });

  it('shows the plain-word reason for a miss', async () => {
    const request = vi.fn().mockResolvedValue({
      matched: false,
      explanation: { value: 0, description: 'no match on required clause (brand:nike)' },
    });
    render(<WhyNotMatched request={request} indexName="products" query={{ match_all: {} }} />);

    fireEvent.change(screen.getByLabelText('Document id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => {
      expect(screen.getByText(/no match on required clause/)).toBeInTheDocument();
    });
    expect(request).toHaveBeenCalledWith('POST', '/products/_explain/7', { query: { match_all: {} } });
  });

  it('shows a match', async () => {
    const request = vi.fn().mockResolvedValue({
      matched: true,
      explanation: { value: 1, description: 'sum of:' },
    });
    render(<WhyNotMatched request={request} indexName="products" query={{ match_all: {} }} />);

    fireEvent.change(screen.getByLabelText('Document id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => {
      expect(screen.getByText(/This document matched/)).toBeInTheDocument();
    });
  });
});
