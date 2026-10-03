import { useState, type FormEvent } from 'react';
import { useConnection } from '../../components/ConnectionProvider';
import { ClusterError } from '../../opensearch/errors';
import './connect.css';

export default function ConnectScreen() {
  const { state, facts, connect } = useConnection();
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ClusterError | null>(null);

  const isWorking = state === 'connecting';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isWorking) {
      return;
    }
    const details = { url, username, password };
    // Cleared as soon as Connect is chosen, win or lose (R2.2).
    setPassword('');
    setError(null);
    try {
      await connect(details);
    } catch (err) {
      setError(err instanceof ClusterError ? err : null);
    }
  }

  return (
    <div className="wrap connect-screen">
      <h1>Connect to a cluster</h1>
      <p className="read-only-tip">
        For the most safety, connect with a user that can only read.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Cluster URL
          <input
            type="text"
            value={url}
            placeholder="https://localhost:9200"
            onChange={(e) => setUrl(e.target.value)}
            disabled={isWorking}
            required
          />
        </label>
        <label>
          Username <span className="optional-hint">(leave empty if the cluster needs no login)</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isWorking}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isWorking}
          />
        </label>
        <button type="submit" className="btn primary" disabled={isWorking}>
          {isWorking ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {error && (
        <div role="alert" className="connect-error">
          <p>{error.message}</p>
          {error.code === 'unreachable' && (
            <ul>
              <li>Check the address and the network.</li>
              <li>
                Open the URL in a new tab once and accept the certificate:{' '}
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </li>
              <li>Allow this page&apos;s address in the cluster&apos;s CORS settings.</li>
            </ul>
          )}
          {error.code === 'timeout' && (
            <ul>
              <li>Check the address and the network.</li>
            </ul>
          )}
        </div>
      )}

      {state === 'connected' && facts && (
        <div className="connect-success">
          <p>
            Connected to <strong>{facts.cluster_name}</strong> ({facts.distribution}{' '}
            {facts.version})
          </p>
          <p>
            {facts.number_of_nodes} node(s), health: {facts.status}
          </p>
        </div>
      )}
    </div>
  );
}
