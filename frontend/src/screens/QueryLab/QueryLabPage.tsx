// The query lab's own top-level page (spec 004): request block on the left, results on the
// right. State is owned here so navigating away and back keeps it (R1.4).
import { Navigate } from 'react-router-dom';
import { useConnection } from '../../components/ConnectionProvider';
import { ClusterError } from '../../opensearch/errors';
import { runQuery, validateQuery, type ValidateResult } from '../../opensearch/querylab';
import { withToggles, type ParsedRequest, type Toggles } from '../../analysis/requestBlock';
import RequestBlock from './RequestBlock';
import ResultsPane, { type RunState } from './ResultsPane';
import { useIndexFields } from './useIndexFields';
import './querylab.css';

export interface QueryLabState {
  text: string;
  toggles: Toggles;
  run: RunState;
  validate: ValidateResult | null;
  selectedHitId: string | null;
  lastIndex: string | null;
  lastQuery: unknown;
}

export const INITIAL_QUERY_LAB_STATE: QueryLabState = {
  text: '',
  toggles: { explain: true, profile: false, validate: false },
  run: { status: 'idle' },
  validate: null,
  selectedHitId: null,
  lastIndex: null,
  lastQuery: {},
};

interface PageProps {
  state: QueryLabState;
  onStateChange: (state: QueryLabState) => void;
}

function QueryLabContent({ state, onStateChange }: PageProps) {
  const { request } = useConnection();
  const fields = useIndexFields(request, state.lastIndex);

  async function onRun(parsed: ParsedRequest) {
    const body = withToggles(parsed.body, state.toggles);
    onStateChange({
      ...state,
      run: { status: 'loading' },
      lastIndex: parsed.index,
      lastQuery: (parsed.body as { query?: unknown }).query ?? {},
    });
    try {
      const [result, validate] = await Promise.all([
        runQuery(request, parsed.method, parsed.path, body),
        state.toggles.validate ? validateQuery(request, parsed.index, parsed.body) : Promise.resolve(null),
      ]);
      onStateChange({
        ...state,
        run: { status: 'ok', result, explainWasOn: state.toggles.explain },
        validate,
        selectedHitId: null,
        lastIndex: parsed.index,
        lastQuery: (parsed.body as { query?: unknown }).query ?? {},
      });
    } catch (err) {
      const error = err instanceof ClusterError ? err : new ClusterError('cluster_error', String(err));
      onStateChange({
        ...state,
        run: { status: 'error', error },
        lastIndex: parsed.index,
        lastQuery: (parsed.body as { query?: unknown }).query ?? {},
      });
    }
  }

  return (
    <div className="wrap query-lab-page">
      <h1>Query lab</h1>
      <div className="query-lab-columns">
        <RequestBlock
          text={state.text}
          toggles={state.toggles}
          loading={state.run.status === 'loading'}
          onChange={(text) => onStateChange({ ...state, text })}
          onToggle={(toggles) => onStateChange({ ...state, toggles })}
          onRun={onRun}
        />
        <ResultsPane
          request={request}
          indexName={state.lastIndex}
          query={state.lastQuery}
          fields={fields}
          run={state.run}
          validate={state.validate}
          selectedHitId={state.selectedHitId}
          onSelectHit={(id) => onStateChange({ ...state, selectedHitId: id })}
        />
      </div>
    </div>
  );
}

// The state is passed in rather than owned here, because the route element unmounts when the
// user navigates to another page; App.tsx holds the state above the router so it survives
// navigating away and back (R1.4), the same way ConnectionProvider holds the connection itself.
export default function QueryLabPage({ state, onStateChange }: PageProps) {
  const { state: connectionState } = useConnection();

  if (connectionState === 'not_connected' || connectionState === 'connecting') {
    return <Navigate to="/connect" replace />;
  }

  return <QueryLabContent state={state} onStateChange={onStateChange} />;
}
