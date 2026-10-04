import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from './ConnectionProvider';
import ConnectionBadge from './ConnectionBadge';

const { createClusterClientMock } = vi.hoisted(() => ({
  createClusterClientMock: vi.fn(),
}));

vi.mock('../opensearch/client', () => ({
  createClusterClient: createClusterClientMock,
}));

const FACTS = {
  cluster_name: 'docker-cluster',
  version: '2.19.0',
  distribution: 'opensearch',
  status: 'green',
  number_of_nodes: 1,
};
const DETAILS = { url: 'https://localhost:9200', username: 'admin', password: 'secret' };

function Harness() {
  const { connect } = useConnection();
  return (
    <>
      <button onClick={() => connect(DETAILS)}>test-connect</button>
      <ConnectionBadge />
    </>
  );
}

function renderBadge() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ConnectionProvider>
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/connect" element={<div>Connect screen</div>} />
        </Routes>
      </ConnectionProvider>
    </MemoryRouter>,
  );
}

describe('ConnectionBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createClusterClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing while not connected', () => {
    createClusterClientMock.mockReturnValue({ connect: vi.fn(), request: vi.fn() });
    renderBadge();
    expect(screen.queryByText('docker-cluster')).not.toBeInTheDocument();
    expect(screen.queryByText('Connection lost')).not.toBeInTheDocument();
  });

  it('R4.1 shows the cluster name and health while connected', async () => {
    createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request: vi.fn() });
    renderBadge();

    await act(async () => {
      fireEvent.click(screen.getByText('test-connect'));
    });

    expect(screen.getByText('docker-cluster')).toBeInTheDocument();
    expect(screen.getByText('green')).toBeInTheDocument();
  });

  it('R4.2 Disconnect forgets the connection and goes to /connect', async () => {
    createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request: vi.fn() });
    renderBadge();
    // R6.3: a remembered URL/username (set by ConnectScreen on an earlier connect) is not
    // something Disconnect should touch — it never held the password to begin with.
    localStorage.setItem('searchlens.connect.v1', JSON.stringify({ url: DETAILS.url, username: DETAILS.username }));

    await act(async () => {
      fireEvent.click(screen.getByText('test-connect'));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    });

    expect(screen.getByText('Connect screen')).toBeInTheDocument();
    expect(screen.queryByText('docker-cluster')).not.toBeInTheDocument();
    expect(localStorage.getItem('searchlens.connect.v1')).not.toBeNull();
  });

  it('R4.3 shows "Connection lost" and "Connect again" when a health check cannot reach the cluster', async () => {
    const { ClusterError } = await import('../opensearch/errors');
    const request = vi
      .fn()
      .mockRejectedValue(new ClusterError('unreachable', 'Cannot reach the cluster at https://localhost:9200.'));
    createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request });
    renderBadge();

    await act(async () => {
      fireEvent.click(screen.getByText('test-connect'));
    });
    expect(screen.getByText('docker-cluster')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByText('Connection lost')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect again' }));
    });
    expect(screen.getByText('Connect screen')).toBeInTheDocument();
  });
});
