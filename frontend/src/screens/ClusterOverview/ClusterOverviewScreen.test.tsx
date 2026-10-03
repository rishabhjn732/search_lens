import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from '../../components/ConnectionProvider';
import { ClusterError } from '../../opensearch/errors';
import ClusterOverviewScreen from './ClusterOverviewScreen';

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

// Connects first (using the mocked client), then renders the screen, so `request`
// inside the screen goes straight to the given fake implementation.
function Harness() {
  const { connect, state } = useConnection();
  useEffect(() => {
    if (state === 'not_connected') {
      void connect({ url: 'https://localhost:9200', username: '', password: '' });
    }
  }, [state, connect]);
  return state === 'connected' ? <ClusterOverviewScreen /> : null;
}

function renderScreen(request: (method: string, path: string, body?: unknown) => Promise<unknown>) {
  createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request });
  return render(
    <ConnectionProvider>
      <Harness />
    </ConnectionProvider>,
  );
}

describe('ClusterOverviewScreen', () => {
  beforeEach(() => {
    createClusterClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the index list once on mount and draws the chart', async () => {
    const request = vi.fn().mockResolvedValue([
      { index: 'products_v7', health: 'green', 'docs.count': '48213', 'store.size': '92340112' },
    ]);
    renderScreen(request);

    await waitFor(() => expect(screen.getByText('products_v7')).toBeInTheDocument());
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('shows the empty-cluster message when there are no indexes', async () => {
    const request = vi.fn().mockResolvedValue([]);
    renderScreen(request);

    await waitFor(() => expect(screen.getByText('This cluster has no indexes yet.')).toBeInTheDocument());
  });

  it('shows the whole-screen message when the list call is forbidden', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ClusterError('forbidden', 'This user is not allowed to read cluster information.'));
    renderScreen(request);

    await waitFor(() =>
      expect(screen.getByText('This user cannot read the list of indexes.')).toBeInTheDocument(),
    );
  });

  it('Refresh reloads the list, and nothing reloads it by itself', async () => {
    const request = vi.fn().mockResolvedValue([
      { index: 'products_v7', health: 'green', 'docs.count': '48213', 'store.size': '92340112' },
    ]);
    renderScreen(request);
    await waitFor(() => expect(screen.getByText('products_v7')).toBeInTheDocument());
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });
    expect(request).toHaveBeenCalledTimes(2);

    // No timer reload: waiting without another click leaves the count unchanged.
    await new Promise((r) => setTimeout(r, 10));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('Refresh also reloads the open index detail (R6.3)', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.startsWith('/_cat/indices')) {
        return Promise.resolve([
          { index: 'products_v7', health: 'green', 'docs.count': '48213', 'store.size': '92340112' },
        ]);
      }
      if (path.endsWith('/_mapping')) {
        return Promise.resolve({ products_v7: { mappings: { properties: { title: { type: 'text' } } } } });
      }
      if (path.endsWith('/_settings')) {
        return Promise.resolve({ products_v7: { settings: { index: {} } } });
      }
      throw new Error(`unexpected call ${path}`);
    });
    renderScreen(request);
    await waitFor(() => expect(screen.getByText('products_v7')).toBeInTheDocument());

    fireEvent.click(screen.getByText('products_v7'));
    await waitFor(() => expect(screen.getByText(/title is text/)).toBeInTheDocument());
    const mappingCallsBefore = request.mock.calls.filter(([, path]) => path.endsWith('/_mapping')).length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });

    await waitFor(() => {
      const mappingCallsAfter = request.mock.calls.filter(([, path]) => path.endsWith('/_mapping')).length;
      expect(mappingCallsAfter).toBeGreaterThan(mappingCallsBefore);
    });
  });

  it('R1.2 redirects to /connect when not connected', () => {
    render(
      <ConnectionProvider>
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route path="/overview" element={<ClusterOverviewScreen />} />
            <Route path="/connect" element={<p>Connect page</p>} />
          </Routes>
        </MemoryRouter>
      </ConnectionProvider>,
    );

    expect(screen.getByText('Connect page')).toBeInTheDocument();
  });
});
