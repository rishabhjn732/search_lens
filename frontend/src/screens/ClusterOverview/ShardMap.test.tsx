import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ShardMap from './ShardMap';
import type { ShardLayout } from '../../opensearch/overview';

const LAYOUT: ShardLayout = [
  { node: 'node-1', shards: [{ shard: '0', kind: 'primary', assigned: true }] },
  { node: null, shards: [{ shard: '0', kind: 'replica', assigned: false }] },
];

describe('ShardMap', () => {
  it('shows the plain-word settings next to the shard picture', () => {
    render(<ShardMap layout={LAYOUT} settings={{ shards: 1, replicas: 1, refreshInterval: '1s' }} />);

    expect(screen.getByText('1 shard')).toBeInTheDocument();
    expect(screen.getByText('1 replica')).toBeInTheDocument();
    expect(screen.getByText('Refreshes every 1s')).toBeInTheDocument();
  });

  it('marks an unassigned shard copy for styling as red', () => {
    render(<ShardMap layout={LAYOUT} settings={null} />);

    const unassigned = screen.getByTitle('replica shard 0 (unassigned)');
    expect(unassigned.className).toContain('unassigned');
    const assigned = screen.getByTitle('primary shard 0');
    expect(assigned.className).toContain('assigned');
  });

  it('shows a node with no node name for unassigned copies', () => {
    render(<ShardMap layout={LAYOUT} settings={null} />);
    expect(screen.getByText('No node (unassigned)')).toBeInTheDocument();
  });
});
