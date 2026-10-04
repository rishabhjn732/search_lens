import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveAnalyzer } from '../../analysis/definition';
import type { Field } from '../../analysis/types';
import FieldTree from './FieldTree';

const STANDARD = resolveAnalyzer('standard', {});
if ('error' in STANDARD) throw new Error('setup: standard analyzer should resolve');

const ENGLISH = resolveAnalyzer('english', {});
if ('error' in ENGLISH) throw new Error('setup: english analyzer should resolve');

describe('FieldTree', () => {
  it('shows a plain sentence and pills for a text field, and a Try it button', () => {
    const fields: Field[] = [{ path: 'title', type: 'text', kind: 'text', indexAnalyzer: 'standard' }];
    const onTryField = vi.fn();
    render(<FieldTree fields={fields} analyzers={{ standard: STANDARD }} onTryField={onTryField} />);

    expect(screen.getByText('title is text, analyzed with standard.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }));
    expect(onTryField).toHaveBeenCalledWith(fields[0], STANDARD);
  });

  it('shows the analyzer\'s real step names as pills, not a plain-English description', () => {
    const fields: Field[] = [{ path: 'description', type: 'text', kind: 'text', indexAnalyzer: 'english' }];
    render(<FieldTree fields={fields} analyzers={{ english: ENGLISH }} onTryField={vi.fn()} />);

    expect(screen.getByText('english_possessive_stemmer')).toBeInTheDocument();
    expect(screen.getByText('lowercase')).toBeInTheDocument();
    expect(screen.getByText('english_stop')).toBeInTheDocument();
    expect(screen.getByText('english_stemmer')).toBeInTheDocument();
    expect(screen.queryByText('cut into words')).not.toBeInTheDocument();
    expect(screen.queryByText('small letters')).not.toBeInTheDocument();
  });

  it('shows a plain sentence for a keyword field with no Try it button', () => {
    const fields: Field[] = [{ path: 'brand', type: 'keyword', kind: 'keyword' }];
    render(<FieldTree fields={fields} analyzers={{}} onTryField={vi.fn()} />);

    expect(screen.getByText('brand is keyword (exact values).')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try it' })).not.toBeInTheDocument();
  });

  it('shows the per-row message for a field that could not be read (R4.5)', () => {
    const fields: Field[] = [{ path: 'broken', type: 'object', kind: 'other' }];
    render(<FieldTree fields={fields} analyzers={{}} onTryField={vi.fn()} />);

    expect(screen.getByText('This field could not be read.')).toBeInTheDocument();
  });

  it('shows nested fields as a tree under their parent object, named by their full path', () => {
    const fields: Field[] = [
      { path: 'address', type: 'object', kind: 'object' },
      { path: 'address.city', type: 'keyword', kind: 'keyword' },
    ];
    render(<FieldTree fields={fields} analyzers={{}} onTryField={vi.fn()} />);

    expect(screen.getByText('address groups the fields below it.')).toBeInTheDocument();
    expect(screen.getByText('address.city is keyword (exact values).')).toBeInTheDocument();
  });

  it('notes a multi-field as an extra way to save its parent, same width as every other row', () => {
    const fields: Field[] = [
      { path: 'brand', type: 'text', kind: 'text', indexAnalyzer: 'standard' },
      { path: 'brand.keyword', type: 'keyword', kind: 'keyword', parent: 'brand' },
    ];
    render(<FieldTree fields={fields} analyzers={{ standard: STANDARD }} onTryField={vi.fn()} />);

    expect(screen.getByText('Extra way to save brand.', { exact: false })).toBeInTheDocument();
    const rows = document.querySelectorAll('.field-row');
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect((row as HTMLElement).style.marginLeft).toBe(''));
  });

  it('shows both the save-time and search-time analyzer when they differ, each with its own Try it', () => {
    const fields: Field[] = [
      {
        path: 'description.syn_hc',
        type: 'text',
        kind: 'text',
        indexAnalyzer: 'standard',
        searchAnalyzer: 'english',
      },
    ];
    const onTryField = vi.fn();
    render(
      <FieldTree
        fields={fields}
        analyzers={{ standard: STANDARD, english: ENGLISH }}
        onTryField={onTryField}
      />,
    );

    expect(screen.getByText((_, node) => node?.textContent === 'Saved with: standard')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Searched with: english')).toBeInTheDocument();
    // The search chain's filters (e.g. english_stop) are now visible, not hidden.
    expect(screen.getByText('english_stop')).toBeInTheDocument();

    const tryButtons = screen.getAllByRole('button', { name: 'Try it' });
    expect(tryButtons).toHaveLength(2);
    fireEvent.click(tryButtons[1]);
    expect(onTryField).toHaveBeenCalledWith(fields[0], ENGLISH);
  });

  it('shows only one chain when the field searches with the same analyzer it was saved with', () => {
    const fields: Field[] = [
      { path: 'title', type: 'text', kind: 'text', indexAnalyzer: 'standard', searchAnalyzer: 'standard' },
    ];
    render(<FieldTree fields={fields} analyzers={{ standard: STANDARD }} onTryField={vi.fn()} />);

    expect(screen.queryByText((_, node) => !!node?.textContent?.startsWith('Saved with:'))).not.toBeInTheDocument();
    expect(screen.queryByText((_, node) => !!node?.textContent?.startsWith('Searched with:'))).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try it' })).toHaveLength(1);
  });
});
