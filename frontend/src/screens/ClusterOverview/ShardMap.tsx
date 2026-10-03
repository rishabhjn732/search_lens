import type { IndexSettings, ShardLayout } from '../../opensearch/overview';

interface Props {
  layout: ShardLayout;
  settings: IndexSettings | null;
}

// The shard/replica picture by node, with unassigned copies in red (R5.1, R5.2),
// and the key settings in plain words next to it (R5.3).
export default function ShardMap({ layout, settings }: Props) {
  return (
    <div className="shard-map">
      {settings && (
        <ul className="shard-settings">
          <li>
            {settings.shards} {settings.shards === 1 ? 'shard' : 'shards'}
          </li>
          <li>
            {settings.replicas} {settings.replicas === 1 ? 'replica' : 'replicas'}
          </li>
          <li>Refreshes every {settings.refreshInterval}</li>
        </ul>
      )}
      <ul className="shard-nodes">
        {layout.map((nodeShards) => (
          <li key={nodeShards.node ?? 'unassigned'} className="shard-node">
            <p className="node-name">{nodeShards.node ?? 'No node (unassigned)'}</p>
            <div className="node-boxes">
              {nodeShards.shards.map((box, i) => (
                <span
                  key={i}
                  className={`shard-box ${box.kind} ${box.assigned ? 'assigned' : 'unassigned'}`}
                  title={`${box.kind} shard ${box.shard}${box.assigned ? '' : ' (unassigned)'}`}
                >
                  {box.shard}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
