import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScoreExplainPanel from './ScoreExplainPanel';
import type { RawExplanationNode } from '../../analysis/explain';

// A single match clause: root is the weight node itself (no "sum of:" wrapper), with a real
// idf+tf breakdown — the common shape for a plain (non-bool) query.
const MATCH_EXPLANATION: RawExplanationNode = {
  value: 3.1407292,
  description: 'weight(title:iphon in 14652) [PerFieldSimilarity], result of:',
  details: [
    {
      value: 3.5881114,
      description: 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:',
      details: [
        { value: 291368, description: 'N, total number of documents with field' },
        { value: 8056, description: 'n, number of documents containing term' },
      ],
    },
    {
      value: 0.8753154,
      description: 'tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:',
      details: [
        { value: 11, description: 'freq, occurrences of term within document' },
        { value: 1.2, description: 'k1, term saturation parameter' },
      ],
    },
  ],
};

// A bool query: two matching fields (each with idf+tf) plus a filter clause with no score.
const BOOL_EXPLANATION: RawExplanationNode = {
  value: 3.6,
  description: 'sum of:',
  details: [
    {
      value: 3.2,
      description: 'weight(title:nike in 0) [PerFieldSimilarity], result of:',
      details: [
        { value: 1.6, description: 'idf, computed as log(...) from:', details: [{ value: 5, description: 'n, docs with term' }] },
        { value: 2.0, description: 'tf, computed as freq from:', details: [{ value: 3, description: 'freq, term count' }] },
      ],
    },
    {
      value: 0.4,
      description: 'weight(description:nike in 0) [PerFieldSimilarity], result of:',
      details: [{ value: 0.4, description: 'idf, computed as log(...) from:', details: [] }],
    },
    { value: 0, description: 'ConstantScoreQuery(brand:nike), product of:', details: [] },
  ],
};

// No idf/tf shape at all — falls back to the generic collapsible tree.
const GENERIC_EXPLANATION: RawExplanationNode = {
  value: 0,
  description: 'Failure to meet condition(s) of required/prohibited clause(s)',
  details: [{ value: 0, description: 'no match on required clause (brand:nike)' }],
};

describe('ScoreExplainPanel', () => {
  it('shows the matched field, token, and raw description', () => {
    render(<ScoreExplainPanel docId="14652" explanation={MATCH_EXPLANATION} queryFields={['title']} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('iphon')).toBeInTheDocument();
    expect(screen.getByText(MATCH_EXPLANATION.description)).toBeInTheDocument();
  });

  it('shows the idf and tf breakdown with real variable names and values', () => {
    render(<ScoreExplainPanel docId="14652" explanation={MATCH_EXPLANATION} queryFields={['title']} />);

    expect(screen.getByText('Inverse document frequency (idf)')).toBeInTheDocument();
    expect(screen.getByText('Term frequency (tf)')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('total number of documents with field')).toBeInTheDocument();
    expect(screen.getByText('291,368')).toBeInTheDocument();
    expect(screen.getByText('freq')).toBeInTheDocument();
  });

  it('shows a formula strip with the real numbers', () => {
    render(<ScoreExplainPanel docId="14652" explanation={MATCH_EXPLANATION} queryFields={['title']} />);

    expect(screen.getByText(/score = idf × tf/)).toBeInTheDocument();
  });

  it('shows one match card per matching field in a bool query', () => {
    render(<ScoreExplainPanel docId="1" explanation={BOOL_EXPLANATION} queryFields={['title']} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText('nike')).toHaveLength(2);
  });

  it('does not render the filter clause as a top-level row (it is in Filters passed instead)', () => {
    render(<ScoreExplainPanel docId="1" explanation={BOOL_EXPLANATION} queryFields={['title']} />);

    expect(screen.queryByText(/ConstantScoreQuery/)).not.toBeInTheDocument();
    expect(screen.getByText('brand:nike')).toBeInTheDocument();
  });

  it('marks fields that did not count', () => {
    render(<ScoreExplainPanel docId="1" explanation={BOOL_EXPLANATION} queryFields={['title', 'brand_name']} />);

    expect(screen.getByText('brand_name')).toBeInTheDocument();
    expect(screen.getByText(/did not count/)).toBeInTheDocument();
  });

  it('falls back to a collapsible generic tree when the row is not an idf/tf shape', () => {
    render(<ScoreExplainPanel docId="1" explanation={GENERIC_EXPLANATION} queryFields={[]} />);

    const button = screen.getByRole('button');
    expect(screen.queryByText(GENERIC_EXPLANATION.description)).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText(GENERIC_EXPLANATION.description)).toBeInTheDocument();
  });
});
