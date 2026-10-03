import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from '../../components/ConnectionProvider';
import { ClusterError } from '../../opensearch/errors';
import IndexDetail from './IndexDetail';

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

function Harness() {
  const { connect, state } = useConnection();
  useEffect(() => {
    if (state === 'not_connected') {
      void connect({ url: 'https://localhost:9200', username: '', password: '' });
    }
  }, [state, connect]);
  return state === 'connected' ? <IndexDetail indexName="products_v7" /> : null;
}

function renderDetail(request: (method: string, path: string, body?: unknown) => Promise<unknown>) {
  createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request });
  return render(
    <ConnectionProvider>
      <Harness />
    </ConnectionProvider>,
  );
}

const MAPPING_BODY = {
  products_v7: { mappings: { properties: { title: { type: 'text', analyzer: 'standard' } } } },
};
const SETTINGS_BODY = { products_v7: { settings: { index: {} } } };

describe('IndexDetail', () => {
  beforeEach(() => {
    createClusterClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Fields tab with the field tree once loaded', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) return Promise.resolve(MAPPING_BODY);
      if (path.endsWith('/_settings')) return Promise.resolve(SETTINGS_BODY);
      throw new Error(`unexpected call ${path}`);
    });
    renderDetail(request);

    await waitFor(() => expect(screen.getByText('title is text, analyzed with standard.')).toBeInTheDocument());
  });

  it('shows a tab-level message when the mapping call is forbidden', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) {
        return Promise.reject(new ClusterError('forbidden', 'This user is not allowed to read cluster information.'));
      }
      return Promise.resolve(SETTINGS_BODY);
    });
    renderDetail(request);

    await waitFor(() => expect(screen.getByText('You do not have permission to see this.')).toBeInTheDocument());
  });

  it('loads and shows the shard picture only after the Settings tab is chosen', async () => {
    const shardRows = [{ index: 'products_v7', shard: '0', prirep: 'p', state: 'STARTED', node: 'node-1' }];
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) return Promise.resolve(MAPPING_BODY);
      if (path.endsWith('/_settings')) return Promise.resolve(SETTINGS_BODY);
      if (path.startsWith('/_cat/shards')) return Promise.resolve(shardRows);
      throw new Error(`unexpected call ${path}`);
    });
    renderDetail(request);
    await waitFor(() => expect(screen.getByText('title is text, analyzed with standard.')).toBeInTheDocument());
    expect(request).not.toHaveBeenCalledWith('GET', expect.stringContaining('_cat/shards'));

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    await waitFor(() => expect(screen.getByTitle('primary shard 0')).toBeInTheDocument());
  });

  it('shows a tab-level message when the settings call is forbidden', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) return Promise.resolve(MAPPING_BODY);
      if (path.endsWith('/_settings')) {
        return Promise.reject(new ClusterError('forbidden', 'This user is not allowed to read cluster information.'));
      }
      throw new Error(`unexpected call ${path}`);
    });
    renderDetail(request);
    await waitFor(() => expect(screen.getByText('title is text, analyzed with standard.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    await waitFor(() => expect(screen.getAllByText('You do not have permission to see this.').length).toBeGreaterThan(0));
  });
});
