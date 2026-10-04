import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RequestBlock from './RequestBlock';
import type { Toggles } from '../../analysis/requestBlock';

const DEFAULT_TOGGLES: Toggles = { explain: true, profile: false, validate: false };

describe('RequestBlock', () => {
  it('starts empty', () => {
    render(
      <RequestBlock text="" toggles={DEFAULT_TOGGLES} loading={false} onChange={vi.fn()} onToggle={vi.fn()} onRun={vi.fn()} />,
    );

    expect(screen.getByLabelText(/Request/)).toHaveValue('');
  });

  it('shows Explain on, Validate and Profile off by default', () => {
    render(
      <RequestBlock text="" toggles={DEFAULT_TOGGLES} loading={false} onChange={vi.fn()} onToggle={vi.fn()} onRun={vi.fn()} />,
    );

    expect(screen.getByLabelText('Explain')).toBeChecked();
    expect(screen.getByLabelText('Validate')).not.toBeChecked();
    expect(screen.getByLabelText('Profile')).not.toBeChecked();
  });

  it('runs a valid request', () => {
    const onRun = vi.fn();
    render(
      <RequestBlock
        text={'GET products/_search\n{"query":{"match_all":{}}}'}
        toggles={DEFAULT_TOGGLES}
        loading={false}
        onChange={vi.fn()}
        onToggle={vi.fn()}
        onRun={onRun}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).toHaveBeenCalledWith({
      ok: true,
      method: 'GET',
      index: 'products',
      path: '/products/_search',
      body: { query: { match_all: {} } },
    });
  });

  it('marks a bad first line in red and does not run', () => {
    const onRun = vi.fn();
    render(
      <RequestBlock text="not a request" toggles={DEFAULT_TOGGLES} loading={false} onChange={vi.fn()} onToggle={vi.fn()} onRun={onRun} />,
    );

    fireEvent.change(screen.getByLabelText(/Request/), { target: { value: 'not a request' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText(/Request/)).toHaveClass('bad');
  });

  it('toggles call onToggle with the changed value', () => {
    const onToggle = vi.fn();
    render(
      <RequestBlock text="" toggles={DEFAULT_TOGGLES} loading={false} onChange={vi.fn()} onToggle={onToggle} onRun={vi.fn()} />,
    );

    fireEvent.click(screen.getByLabelText('Validate'));

    expect(onToggle).toHaveBeenCalledWith({ explain: true, profile: false, validate: true });
  });

  it('disables Run while loading', () => {
    render(
      <RequestBlock text="" toggles={DEFAULT_TOGGLES} loading onChange={vi.fn()} onToggle={vi.fn()} onRun={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();
  });
});
