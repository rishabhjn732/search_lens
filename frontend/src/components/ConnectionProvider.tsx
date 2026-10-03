import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClusterClient, type ClusterClient, type ClusterFacts, type ConnectDetails } from '../opensearch/client';
import { ClusterError } from '../opensearch/errors';

export type ConnectionState = 'not_connected' | 'connecting' | 'connected' | 'lost';

const HEALTH_CHECK_MS = 15000;

interface ConnectionContextValue {
  state: ConnectionState;
  facts: ClusterFacts | null;
  connect: (details: ConnectDetails) => Promise<void>;
  disconnect: () => void;
  request: (method: string, path: string, body?: unknown) => Promise<unknown>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectionState>('not_connected');
  const [facts, setFacts] = useState<ClusterFacts | null>(null);
  const clientRef = useRef<ClusterClient | null>(null);

  const disconnect = useCallback(() => {
    clientRef.current = null;
    setFacts(null);
    setState('not_connected');
  }, []);

  const connect = useCallback(async (details: ConnectDetails) => {
    setState('connecting');
    try {
      const client = createClusterClient(details);
      const newFacts = await client.connect();
      clientRef.current = client;
      setFacts(newFacts);
      setState('connected');
    } catch (err) {
      setState('not_connected');
      throw err;
    }
  }, []);

  const request = useCallback(
    async (method: string, path: string, body?: unknown) => {
      if (!clientRef.current) {
        throw new ClusterError('unreachable', 'Not connected to a cluster.');
      }
      try {
        return await clientRef.current.request(method, path, body);
      } catch (err) {
        if (err instanceof ClusterError && (err.code === 'unreachable' || err.code === 'timeout')) {
          setState('lost');
        }
        throw err;
      }
    },
    [],
  );

  useEffect(() => {
    if (state !== 'connected') {
      return;
    }
    const interval = setInterval(async () => {
      if (!clientRef.current) {
        return;
      }
      try {
        const health = (await clientRef.current.request('GET', '/_cluster/health')) as {
          status: string;
          number_of_nodes: number;
        };
        setFacts((prev) => (prev ? { ...prev, status: health.status, number_of_nodes: health.number_of_nodes } : prev));
      } catch (err) {
        if (err instanceof ClusterError && (err.code === 'unreachable' || err.code === 'timeout')) {
          setState('lost');
        }
      }
    }, HEALTH_CHECK_MS);
    return () => clearInterval(interval);
  }, [state]);

  return (
    <ConnectionContext.Provider value={{ state, facts, connect, disconnect, request }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const value = useContext(ConnectionContext);
  if (!value) {
    throw new Error('useConnection must be used inside a ConnectionProvider.');
  }
  return value;
}
