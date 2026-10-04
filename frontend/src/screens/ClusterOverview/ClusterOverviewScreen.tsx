import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useConnection } from '../../components/ConnectionProvider';
import { ClusterError } from '../../opensearch/errors';
import { listIndexSummaries, type IndexSummary } from '../../opensearch/overview';
import IndexChart from './IndexChart';
import IndexDetail from './IndexDetail';
import IndexSearch from './IndexSearch';
import SelectedIndexSummary from './SelectedIndexSummary';
import './overview.css';

type Load = { status: 'loading' } | { status: 'error'; error: ClusterError } | { status: 'ok'; indexes: IndexSummary[] };

export default function ClusterOverviewScreen() {
  const { state, request } = useConnection();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [openIndexName, setOpenIndexName] = useState<string | null>(null);
  // Bumped by Refresh so the open index's detail reloads too (R6.3); IndexDetail
  // re-fetches whenever this number changes.
  const [refreshToken, setRefreshToken] = useState(0);
  const isConnected = state === 'connected' || state === 'lost';

  const reload = useCallback(async () => {
    setLoad({ status: 'loading' });
    setRefreshToken((n) => n + 1);
    try {
      const indexes = await listIndexSummaries(request);
      setLoad({ status: 'ok', indexes });
    } catch (err) {
      setLoad({ status: 'error', error: err instanceof ClusterError ? err : new ClusterError('cluster_error', String(err)) });
    }
  }, [request]);

  // Loads once on mount; nothing else reloads it on its own (R6.1, R6.4).
  useEffect(() => {
    if (isConnected) reload();
  }, [isConnected, reload]);

  // R1.2: this screen is only for a connected user; otherwise go to Connect. The header's
  // own banner (R8.2) covers a connection that was lost mid-use, so 'lost' still renders here.
  if (state === 'not_connected' || state === 'connecting') {
    return <Navigate to="/connect" replace />;
  }

  return (
    <div className="wrap overview-screen">
      <div className="overview-head">
        <h1>Cluster overview</h1>
        <button type="button" className="btn ghost small" onClick={reload} disabled={load.status === 'loading'}>
          Refresh
        </button>
      </div>

      {load.status === 'loading' && <p className="overview-loading">Loading indexes…</p>}

      {load.status === 'error' && (
        <p className="overview-error" role="alert">
          {load.error.code === 'forbidden'
            ? 'This user cannot read the list of indexes.'
            : load.error.message}
        </p>
      )}

      {load.status === 'ok' && (
        openIndexName ? (
          <SelectedIndexSummary
            index={load.indexes.find((i) => i.name === openIndexName) ?? { name: openIndexName, health: '?', docsCount: 0, sizeBytes: 0, isSystem: false }}
            onBack={() => setOpenIndexName(null)}
          />
        ) : (
          <>
            <IndexSearch indexes={load.indexes} onOpenIndex={setOpenIndexName} />
            <IndexChart indexes={load.indexes} onOpenIndex={setOpenIndexName} />
          </>
        )
      )}

      {openIndexName && <IndexDetail indexName={openIndexName} refreshToken={refreshToken} />}
    </div>
  );
}
