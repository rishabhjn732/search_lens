import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveAnalyzer } from '../../analysis/definition';
import type { Field } from '../../analysis/types';
import FieldTree from './FieldTree';

const STANDARD = resolveAnalyzer('standard', {});
if ('error' in STANDARD) throw new Error('setup: standard analyzer should resolve');

describe('FieldTree', () => {
  it('shows a plain sentence and pills for a text field, and a try it box', () => {
    const fields: Field[] = [{ path: 'title', type: 'text', kind: 'text', indexAnalyzer: 'standard' }];
    render(<FieldTree fields={fields} analyzers={{ standard: STANDARD }} onTry={vi.fn()} />);

    expect(screen.getByText('title is text, analyzed with standard.')).toBeInTheDocument();
    expect(screen.getByLabelText('Text to try')).toBeInTheDocument();
  });

  it('shows a plain sentence for a keyword field with no pills', () => {
    const fields: Field[] = [{ path: 'brand', type: 'keyword', kind: 'keyword' }];
    render(<FieldTree fields={fields} analyzers={{}} onTry={vi.fn()} />);

    expect(screen.getByText('brand is keyword (exact values).')).toBeInTheDocument();
    expect(screen.queryByLabelText('Text to try')).not.toBeInTheDocument();
  });

  it('shows the per-row message for a field that could not be read (R4.5)', () => {
    const fields: Field[] = [{ path: 'broken', type: 'object', kind: 'other' }];
    render(<FieldTree fields={fields} analyzers={{}} onTry={vi.fn()} />);

    expect(screen.getByText('This field could not be read.')).toBeInTheDocument();
  });

  it('shows nested fields as a tree under their parent object', () => {
    const fields: Field[] = [
      { path: 'address', type: 'object', kind: 'object' },
      { path: 'address.city', type: 'keyword', kind: 'keyword' },
    ];
    render(<FieldTree fields={fields} analyzers={{}} onTry={vi.fn()} />);

    expect(screen.getByText('address groups the fields below it.')).toBeInTheDocument();
    expect(screen.getByText('city is keyword (exact values).')).toBeInTheDocument();
  });
});
