import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultsPane, { type RunState } from './ResultsPane';
import { ClusterError } from '../../opensearch/errors';
import type { Field } from '../../analysis/types';

const FIELDS: Field[] = [{ path: 'title', type: 'text', kind: 'text' }];

describe('ResultsPane', () => {
  it('shows the validate result', () => {
    render(
      <ResultsPane
        request={vi.fn()}
        indexName="products"
        query={{ match_all: {} }}
        fields={FIELDS}
        run={{ status: 'idle' }}
        validate={{ valid: true, explanations: [{ index: 'products', valid: true, explanation: '+title:nike' }] }}
        selectedHitId={null}
        onSelectHit={vi.fn()}
      />,
    );

    expect(screen.getByText('This query is valid.')).toBeInTheDocument();
    expect(screen.getByText('+title:nike')).toBeInTheDocument();
  });

  it('shows the cluster error reason in place of hits', () => {
    const run: RunState = {
      status: 'error',
      error: new ClusterError('cluster_error', 'The cluster answered with error 400.', {
        status: 400,
        body: { error: { reason: 'failed to parse query' } },
      }),
    };
    render(
      <ResultsPane
        request={vi.fn()}
        indexName="products"
        query={{}}
        fields={FIELDS}
        run={run}
        validate={null}
        selectedHitId={null}
        onSelectHit={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('failed to parse query');
  });

  it('shows a note instead of the score panel when Explain was off', () => {
    const run: RunState = {
      status: 'ok',
      explainWasOn: false,
      result: { total: 1, hits: [{ id: '1', score: 1, source: {}, explanation: null }] },
    };
    render(
      <ResultsPane
        request={vi.fn()}
        indexName="products"
        query={{}}
        fields={FIELDS}
        run={run}
        validate={null}
        selectedHitId="1"
        onSelectHit={vi.fn()}
      />,
    );

    expect(screen.getByText(/Turn Explain on/)).toBeInTheDocument();
  });

  it('shows the score panel for the selected hit when Explain was on', () => {
    const run: RunState = {
      status: 'ok',
      explainWasOn: true,
      result: {
        total: 1,
        hits: [{ id: '1', score: 1, source: {}, explanation: { value: 1, description: 'sum of:', details: [] } }],
      },
    };
    render(
      <ResultsPane
        request={vi.fn()}
        indexName="products"
        query={{}}
        fields={FIELDS}
        run={run}
        validate={null}
        selectedHitId="1"
        onSelectHit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Score for document 1')).toBeInTheDocument();
  });
});
