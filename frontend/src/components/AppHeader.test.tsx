import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from './ConnectionProvider';
import AppHeader from './AppHeader';

const { createClusterClientMock } = vi.hoisted(() => ({
  createClusterClientMock: vi.fn(),
}));

vi.mock('../opensearch/client', () => ({
  createClusterClient: createClusterClientMock,
}));

function Harness({ connectOnMount }: { connectOnMount: boolean }) {
  const { connect } = useConnection();
  useEffect(() => {
    if (connectOnMount) {
      void connect({ url: 'https://localhost:9200', username: '', password: '' });
    }
  }, [connectOnMount, connect]);
  return <AppHeader />;
}

function renderHeader(connectOnMount: boolean) {
  createClusterClientMock.mockReturnValue({
    connect: vi.fn().mockResolvedValue({
      cluster_name: 'docker-cluster',
      version: '2.19.0',
      distribution: 'opensearch',
      status: 'green',
      number_of_nodes: 1,
    }),
    request: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <ConnectionProvider>
        <Harness connectOnMount={connectOnMount} />
      </ConnectionProvider>
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
  it('does not show Query lab when not connected', () => {
    renderHeader(false);

    expect(screen.queryByRole('link', { name: 'Query lab' })).not.toBeInTheDocument();
  });

  it('shows Query lab once connected', async () => {
    renderHeader(true);

    expect(await screen.findByRole('link', { name: 'Query lab' })).toBeInTheDocument();
  });
});
