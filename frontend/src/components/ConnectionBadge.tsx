import { useNavigate } from 'react-router-dom';
import { useConnection } from './ConnectionProvider';
import './ConnectionBadge.css';

export default function ConnectionBadge() {
  const { state, facts, disconnect } = useConnection();
  const navigate = useNavigate();

  if (state === 'lost') {
    return (
      <div className="connection-badge lost">
        <span>Connection lost</span>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => {
            disconnect();
            navigate('/connect');
          }}
        >
          Connect again
        </button>
      </div>
    );
  }

  if (state !== 'connected' || !facts) {
    return null;
  }

  return (
    <div className="connection-badge connected">
      <span className="cluster-name">{facts.cluster_name}</span>
      <span className={`health health-${facts.status}`}>{facts.status}</span>
      <button
        type="button"
        className="btn small ghost"
        onClick={() => {
          disconnect();
          navigate('/connect');
        }}
      >
        Disconnect
      </button>
    </div>
  );
}
