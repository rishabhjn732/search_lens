import { useEffect, useRef, useState } from 'react';
import { useConnection } from '../../components/ConnectionProvider';
import {
  getIndexDetail,
  getShardLayout,
  type IndexDetail as Detail,
  type ShardLayout,
} from '../../opensearch/overview';
import type { Chain, Field } from '../../analysis/types';
import FieldPlayground from './FieldPlayground';
import FieldTree from './FieldTree';
import ShardMap from './ShardMap';

type Tab = 'fields' | 'settings';
type Load = { status: 'loading' } | { status: 'ok'; detail: Detail };
type ShardLoad = { status: 'loading' } | { status: 'ok'; layout: ShardLayout } | { status: 'error' };
type Playground = { field: Field; chain: Chain };

interface Props {
  indexName: string;
  // Changing this (from ClusterOverviewScreen's Refresh button) re-fetches both tabs (R6.3).
  refreshToken?: number;
}

export default function IndexDetail({ indexName, refreshToken = 0 }: Props) {
  const { request } = useConnection();
  const [tab, setTab] = useState<Tab>('fields');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [shardLoad, setShardLoad] = useState<ShardLoad | null>(null);
  const [playground, setPlayground] = useState<Playground | null>(null);
  const shardLoadStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    getIndexDetail(request, indexName).then((detail) => {
      if (!cancelled) setLoad({ status: 'ok', detail });
    });
    return () => {
      cancelled = true;
    };
  }, [request, indexName, refreshToken]);

  useEffect(() => {
    shardLoadStarted.current = false;
    setShardLoad(null);
    setPlayground(null);
  }, [indexName, refreshToken]);

  // The shard picture is only asked for once the Settings tab is actually opened, and
  // only once per index/refresh (the ref guard stops a second fetch when this effect
  // re-runs after setShardLoad below causes a render).
  useEffect(() => {
    if (tab !== 'settings' || shardLoadStarted.current) return;
    shardLoadStarted.current = true;
    let cancelled = false;
    setShardLoad({ status: 'loading' });
    getShardLayout(request, indexName)
      .then((layout) => {
        if (!cancelled) setShardLoad({ status: 'ok', layout });
      })
      .catch(() => {
        if (!cancelled) setShardLoad({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, request, indexName]);

  return (
    <section className="index-detail" aria-label={`Details for ${indexName}`}>
      <h2>{indexName}</h2>
      <div className="detail-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'fields'} onClick={() => setTab('fields')}>
          Fields
        </button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>
          Settings
        </button>
      </div>

      {load.status === 'loading' && <p className="detail-loading">Loading {indexName}…</p>}

      {load.status === 'ok' && tab === 'fields' && (
        load.detail.fieldsError ? (
          <p className="detail-forbidden">You do not have permission to see this.</p>
        ) : playground ? (
          <FieldPlayground
            field={playground.field}
            chain={playground.chain}
            onClose={() => setPlayground(null)}
          />
        ) : (
          <FieldTree
            fields={load.detail.fields ?? []}
            analyzers={load.detail.analyzers}
            onTryField={(field, chain) => setPlayground({ field, chain })}
          />
        )
      )}

      {load.status === 'ok' && tab === 'settings' && (
        load.detail.settingsError ? (
          <p className="detail-forbidden">You do not have permission to see this.</p>
        ) : (
          <>
            {(shardLoad === null || shardLoad.status === 'loading') && (
              <p className="detail-loading">Loading shards…</p>
            )}
            {shardLoad?.status === 'error' && (
              <p className="detail-forbidden">You do not have permission to see this.</p>
            )}
            {shardLoad?.status === 'ok' && (
              <ShardMap layout={shardLoad.layout} settings={load.detail.settings} />
            )}
          </>
        )
      )}
    </section>
  );
}
