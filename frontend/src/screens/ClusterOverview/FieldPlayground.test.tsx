import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAnalyzer } from '../../analysis/definition';
import type { Field } from '../../analysis/types';
import { ConnectionProvider, useConnection } from '../../components/ConnectionProvider';
import { STORAGE_KEY } from '../../wordlists/store';
import { resetWordListStoreForTests } from '../../wordlists/useWordLists';
import FieldPlayground from './FieldPlayground';

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

const FIELD: Field = { path: 'title', type: 'text', kind: 'text', indexAnalyzer: 'standard' };

function chainWith(filterNames: string[], filterDefs: Record<string, object> = {}) {
  const settings = {
    analyzer: { mine: { type: 'custom', tokenizer: 'standard', filter: filterNames } },
    filter: filterDefs,
  };
  const result = resolveAnalyzer('mine', settings);
  if ('error' in result) throw new Error('setup: chain should resolve');
  return result;
}

function tokenResponse(tokenfilterNames: string[], firstToken = 'run') {
  return {
    detail: {
      custom_analyzer: true,
      charfilters: [],
      tokenizer: { name: 'standard', tokens: [{ token: firstToken, start_offset: 0, end_offset: 3, type: 'word', position: 0 }] },
      tokenfilters: tokenfilterNames.map((name) => ({
        name,
        tokens: [{ token: firstToken, start_offset: 0, end_offset: 3, type: 'word', position: 0 }],
      })),
    },
  };
}

function Harness({ children }: { children: React.ReactNode }) {
  const { connect, state } = useConnection();
  useEffect(() => {
    if (state === 'not_connected') void connect({ url: 'https://localhost:9200', username: '', password: '' });
  }, [state, connect]);
  return state === 'connected' ? <>{children}</> : null;
}

function renderPlayground(request: (method: string, path: string, body?: unknown) => Promise<unknown>, chain = chainWith(['reverse', 'uppercase']), onClose = vi.fn()) {
  createClusterClientMock.mockReturnValue({ connect: vi.fn().mockResolvedValue(FACTS), request });
  return render(
    <ConnectionProvider>
      <Harness>
        <FieldPlayground indexName="products_v7" field={FIELD} chain={chain} onClose={onClose} />
      </Harness>
    </ConnectionProvider>,
  );
}

function seedWordLists(files: { type: 'synonym' | 'entity'; entries: string[] }[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      files: files.map((f, i) => ({ id: `f${i}`, type: f.type, name: `${f.type}.txt`, enabled: true, updated: 0, entries: f.entries })),
    }),
  );
  resetWordListStoreForTests();
}

describe('FieldPlayground', () => {
  beforeEach(() => {
    createClusterClientMock.mockReset();
    localStorage.clear();
    resetWordListStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the real cluster for the chain and shows the tokens (R9.1, R9.2)', async () => {
    const request = vi.fn().mockImplementation((method: string, path: string) => {
      if (path.endsWith('/_analyze')) return Promise.resolve(tokenResponse(['reverse', 'uppercase']));
      throw new Error(`unexpected call ${method} ${path}`);
    });
    renderPlayground(request);

    await waitFor(() => expect(screen.getByText('Tokenizer: standard')).toBeInTheDocument());
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      'POST',
      '/products_v7/_analyze',
      expect.objectContaining({ tokenizer: 'standard', filter: ['reverse', 'uppercase'], text: 'Running Shoes' }),
    ));
  });

  it('says plainly that nothing on the cluster changes (R9.7)', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['reverse', 'uppercase']));
    renderPlayground(request);
    await waitFor(() =>
      expect(screen.getByText(/never changes the field's real analyzer/)).toBeInTheDocument(),
    );
  });

  it('moving a filter re-sends the request with the new order (R9.3, R9.4)', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['reverse', 'uppercase']));
    renderPlayground(request);
    await waitFor(() => expect(request).toHaveBeenCalled());
    request.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Move uppercase earlier' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'POST',
        '/products_v7/_analyze',
        expect.objectContaining({ filter: ['uppercase', 'reverse'] }),
      ),
    );
  });

  it('Reset restores the cluster order and re-sends the request (R9.5)', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['reverse', 'uppercase']));
    renderPlayground(request);
    await waitFor(() => expect(request).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Move uppercase earlier' }));
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith('POST', '/products_v7/_analyze', expect.objectContaining({ filter: ['uppercase', 'reverse'] })),
    );

    fireEvent.click(screen.getByRole('button', { name: "Reset to the cluster's order" }));

    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith('POST', '/products_v7/_analyze', expect.objectContaining({ filter: ['reverse', 'uppercase'] })),
    );
  });

  it('calls onClose when Close is chosen (R9.6)', async () => {
    const onClose = vi.fn();
    const request = vi.fn().mockResolvedValue(tokenResponse(['reverse', 'uppercase']));
    renderPlayground(request, chainWith(['reverse', 'uppercase']), onClose);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the synonym source choice only when a synonym list is saved, and sends an inline filter when chosen (R10.1-R10.3)', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['lowercase', 'synonym_filter_hc']));
    seedWordLists([{ type: 'synonym', entries: ['ai supplychain, ai_supplychain'] }]);
    renderPlayground(request, chainWith(['lowercase', 'synonym_filter_hc'], { synonym_filter_hc: { type: 'synonym', synonyms: ['x => y'] } }));

    await waitFor(() => expect(screen.getByText('Source:')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Source:'), { target: { value: 'saved' } });

    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        'POST',
        '/products_v7/_analyze',
        expect.objectContaining({
          filter: ['lowercase', { type: 'synonym', synonyms: ['ai supplychain, ai_supplychain'] }],
        }),
      ),
    );
  });

  it('hides the synonym choice when no synonym list is saved', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['lowercase', 'synonym_filter_hc']));
    seedWordLists([]);
    renderPlayground(request, chainWith(['lowercase', 'synonym_filter_hc'], { synonym_filter_hc: { type: 'synonym', synonyms: ['x => y'] } }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByText('Source:')).not.toBeInTheDocument();
  });

  it('shows the entity switch only when an entity list is saved, sends the joined form, and displays the original spacing (R10.4, R10.5)', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['lowercase'], 'ai_supplychain'));
    seedWordLists([{ type: 'entity', entries: ['ai supplychain'] }]);
    renderPlayground(request, chainWith(['lowercase']));
    await waitFor(() => expect(request).toHaveBeenCalled());
    request.mockClear();

    fireEvent.change(screen.getByLabelText('Text to try'), { target: { value: 'ai supplychain tools' } });
    fireEvent.click(screen.getByLabelText('Collapse saved entities first'));

    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        'POST',
        '/products_v7/_analyze',
        expect.objectContaining({ text: 'ai_supplychain tools' }),
      ),
    );
    expect(screen.getByText('Joined: ai supplychain')).toBeInTheDocument();
    // The chip shown to the user has its real spacing back, not the join character (R10.5) —
    // this is the exact bug the user caught: the delimiter must never leak into the display.
    await waitFor(() => expect(screen.getAllByText('ai supplychain').length).toBeGreaterThan(0));
    expect(screen.queryByText('ai_supplychain')).not.toBeInTheDocument();
  });

  it('hides the entity switch when no entity list is saved', async () => {
    const request = vi.fn().mockResolvedValue(tokenResponse(['lowercase']));
    seedWordLists([]);
    renderPlayground(request, chainWith(['lowercase']));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByLabelText('Collapse saved entities first')).not.toBeInTheDocument();
  });
});
