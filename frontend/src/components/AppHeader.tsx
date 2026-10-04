import { Link, NavLink } from 'react-router-dom';
import { useConnection } from './ConnectionProvider';
import ConnectionBadge from './ConnectionBadge';
import './AppHeader.css';

export default function AppHeader() {
  const { state } = useConnection();
  const isConnected = state === 'connected' || state === 'lost';

  return (
    <header className="app-header">
      <div className="wrap">
        <Link className="logo" to="/">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <line x1="18" y1="18" x2="25" y2="25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3" fill="var(--blue)" />
          </svg>
          Search Lens
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/mapping-lab">Mapping lab</NavLink>
          <NavLink to="/word-lists">Word lists</NavLink>
          {isConnected && <NavLink to="/query-lab">Query lab</NavLink>}
          <NavLink to="/connect">Connect</NavLink>
        </nav>
        <ConnectionBadge />
      </div>
    </header>
  );
}
