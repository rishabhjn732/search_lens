import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuerySummary from './QuerySummary';
import type { Field } from '../../analysis/types';

const FIELDS: Field[] = [{ path: 'title', type: 'text', kind: 'text' }];

describe('QuerySummary', () => {
  it('shows the plain-word sentence for a valid query', () => {
    render(<QuerySummary query={{ match: { title: 'nike' } }} fields={FIELDS} />);

    expect(screen.getByText(/Your query looks for the words of "nike" in title/)).toBeInTheDocument();
  });

  it('shows a warning for a term clause on a text field', () => {
    render(<QuerySummary query={{ term: { title: 'nike' } }} fields={FIELDS} />);

    expect(screen.getByText(/gets split into words/)).toBeInTheDocument();
  });

  it('shows no warnings when there are none', () => {
    render(<QuerySummary query={{ match_all: {} }} fields={FIELDS} />);

    expect(screen.queryByText(/gets split into words/)).not.toBeInTheDocument();
  });
});
