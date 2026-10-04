import { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from '../../components/ConnectionProvider';
import QueryLabPage, { INITIAL_QUERY_LAB_STATE, type QueryLabState } from './QueryLabPage';

const { createClusterClientMock } = vi.hoisted(() => ({
  createClusterClientMock: vi.fn(),
}));

vi.mock('../../opensearch/client', () => ({
  createClusterClient: createClusterClientMock,
}));

const FACTS = {
  cluster_name: 'docker-cluster',
  version: '2.19.0',
  distribution: 'opensearch',
  status: 'green',
  number_of_nodes: 1,
};

function Harness({ connectOnMount }: { connectOnMount: boolean }) {
  const { connect, state: connectionState } = useConnection();
  const [state, setState] = useState<QueryLabState>(INITIAL_QUERY_LAB_STATE);
  useEffect(() => {
    if (connectOnMount) void connect({ url: 'https://localhost:9200', username: '', password: '' });
  }, [connectOnMount, connect]);

  // Mirrors the pattern other screens' tests use (e.g. IndexDetail.test.tsx): mount the
  // guarded route only once connected, so the redirect isn't racing the async connect() call.
  if (connectOnMount && connectionState !== 'connected') return null;

  return (
    <>
      <Link to="/other">go elsewhere</Link>
      <Link to="/query-lab">back to query lab</Link>
      <Routes>
        <Route path="/query-lab" element={<QueryLabPage state={state} onStateChange={setState} />} />
        <Route path="/connect" element={<div>Connect screen</div>} />
        <Route path="/other" element={<div>Other screen</div>} />
      </Routes>
    </>
  );
}

function renderPage(connectOnMount: boolean, request: (m: string, p: string, b?: unknown) => Promise<unknown> = vi.fn()) {
  createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request });
  return render(
    <MemoryRouter initialEntries={['/query-lab']}>
      <ConnectionProvider>
        <Harness connectOnMount={connectOnMount} />
      </ConnectionProvider>
    </MemoryRouter>,
  );
}

describe('QueryLabPage', () => {
  it('redirects to /connect when not connected', () => {
    renderPage(false);

    expect(screen.getByText('Connect screen')).toBeInTheDocument();
  });

  it('runs a request and shows the hits', async () => {
    const request = vi.fn().mockImplementation((_m: string, path: string) => {
      if (path === '/products/_search') {
        return Promise.resolve({
          hits: { total: { value: 1 }, hits: [{ _id: '1', _score: 2, _source: {}, _explanation: { value: 2, description: 'sum of:', details: [] } }] },
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    renderPage(true, request);
    await waitFor(() => expect(screen.getByLabelText(/Request/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Request/), {
      target: { value: 'GET products/_search\n{"query":{"match_all":{}}}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(screen.getByText(/1 document matched/)).toBeInTheDocument());
  });

  it('keeps the typed request when navigating away and back (R1.4)', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getByLabelText(/Request/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Request/), { target: { value: 'GET products/_search' } });

    fireEvent.click(screen.getByRole('link', { name: 'go elsewhere' }));
    expect(screen.getByText('Other screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'back to query lab' }));

    expect(screen.getByLabelText(/Request/)).toHaveValue('GET products/_search');
  });
});
