import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionProvider, useConnection } from './ConnectionProvider';
import { ClusterError } from '../opensearch/errors';

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

function renderConnection() {
  return renderHook(() => useConnection(), { wrapper: ConnectionProvider });
}

describe('ConnectionProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createClusterClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts as not_connected, with no facts', () => {
    createClusterClientMock.mockReturnValue({ connect: vi.fn(), request: vi.fn() });
    const { result } = renderConnection();
    expect(result.current.state).toBe('not_connected');
    expect(result.current.facts).toBeNull();
  });

  it('connect() moves to connecting, then connected with facts', async () => {
    let resolveConnect!: (value: typeof FACTS) => void;
    const clientConnect = vi.fn(() => new Promise((resolve) => (resolveConnect = resolve)));
    createClusterClientMock.mockReturnValue({ connect: clientConnect, request: vi.fn() });

    const { result } = renderConnection();
    let connectPromise!: Promise<void>;
    act(() => {
      connectPromise = result.current.connect(DETAILS);
    });
    expect(result.current.state).toBe('connecting');

    await act(async () => {
      resolveConnect(FACTS);
      await connectPromise;
    });

    expect(result.current.state).toBe('connected');
    expect(result.current.facts).toEqual(FACTS);
  });

  it('connect() failure goes back to not_connected and rethrows the error', async () => {
    const error = new ClusterError('auth_failed', 'The username or password is wrong.');
    const clientConnect = vi.fn().mockRejectedValue(error);
    createClusterClientMock.mockReturnValue({ connect: clientConnect, request: vi.fn() });

    const { result } = renderConnection();
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.connect(DETAILS);
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(error);
    expect(result.current.state).toBe('not_connected');
    expect(result.current.facts).toBeNull();
  });

  it('disconnect() forgets the client and returns to not_connected', async () => {
    const clientConnect = vi.fn().mockResolvedValue(FACTS);
    createClusterClientMock.mockReturnValue({ connect: clientConnect, request: vi.fn() });

    const { result } = renderConnection();
    await act(async () => {
      await result.current.connect(DETAILS);
    });
    expect(result.current.state).toBe('connected');

    act(() => {
      result.current.disconnect();
    });
    expect(result.current.state).toBe('not_connected');
    expect(result.current.facts).toBeNull();
  });

  it('a fresh render (like a reload) starts as not_connected again', () => {
    createClusterClientMock.mockReturnValue({ connect: vi.fn(), request: vi.fn() });
    const first = renderConnection();
    first.unmount();
    const second = renderConnection();
    expect(second.result.current.state).toBe('not_connected');
  });

  it('becomes lost when the 15 second health check cannot reach the cluster', async () => {
    const clientConnect = vi.fn().mockResolvedValue(FACTS);
    const clientRequest = vi
      .fn()
      .mockRejectedValue(new ClusterError('unreachable', 'Cannot reach the cluster at https://localhost:9200.'));
    createClusterClientMock.mockReturnValue({ connect: clientConnect, request: clientRequest });

    const { result } = renderConnection();
    await act(async () => {
      await result.current.connect(DETAILS);
    });
    expect(result.current.state).toBe('connected');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(result.current.state).toBe('lost');
  });
});
