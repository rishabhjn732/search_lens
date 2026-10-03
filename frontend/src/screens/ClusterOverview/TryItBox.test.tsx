import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TryItBox from './TryItBox';
import { ClusterError } from '../../opensearch/errors';

describe('TryItBox', () => {
  it('shows the resulting tokens after Try it', async () => {
    const onTry = vi.fn().mockResolvedValue([
      { token: 'run', start_offset: 0, end_offset: 7, type: '<ALPHANUM>', position: 0 },
      { token: 'shoe', start_offset: 8, end_offset: 13, type: '<ALPHANUM>', position: 1 },
    ]);
    render(<TryItBox onTry={onTry} />);

    fireEvent.change(screen.getByLabelText('Text to try'), { target: { value: 'Running Shoes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }));

    await waitFor(() => expect(screen.getByText('run')).toBeInTheDocument());
    expect(screen.getByText('shoe')).toBeInTheDocument();
    expect(onTry).toHaveBeenCalledWith('Running Shoes');
  });

  it('shows an error message when the call fails', async () => {
    const onTry = vi.fn().mockRejectedValue(new ClusterError('cluster_error', 'The cluster answered with error 500.'));
    render(<TryItBox onTry={onTry} />);

    fireEvent.change(screen.getByLabelText('Text to try'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }));

    await waitFor(() => expect(screen.getByText('The cluster answered with error 500.')).toBeInTheDocument());
  });

  it('disables Try it until text is typed', () => {
    render(<TryItBox onTry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try it' })).toBeDisabled();
  });
});
