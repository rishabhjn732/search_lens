import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ScreenCard {
  num: string;
  name: string;
  text: string;
  to: string;
  ready: boolean; // Later specs turn their card on.
  icon: ReactNode;
}

const stroke = { strokeWidth: 2 };

export const SCREENS: ScreenCard[] = [
  {
    num: '01',
    name: 'Connect',
    text: 'Enter the cluster URL, user and password.',
    to: '/connect',
    ready: true,
    icon: (
      <>
        <rect x="4" y="12" width="36" height="20" rx="5" fill="var(--blue-bg)" stroke="var(--blue)" {...stroke} />
        <circle cx="14" cy="22" r="3" fill="var(--blue)" />
        <line x1="21" y1="22" x2="34" y2="22" stroke="var(--blue)" {...stroke} />
      </>
    ),
  },
  {
    num: '02',
    name: 'Cluster overview',
    text: 'Indexes, mappings, templates, nodes and health.',
    to: '/overview',
    ready: false,
    icon: (
      <>
        <rect x="5" y="6" width="14" height="14" rx="3" fill="var(--green-bg)" stroke="var(--green)" {...stroke} />
        <rect x="25" y="6" width="14" height="14" rx="3" fill="var(--green-bg)" stroke="var(--green)" {...stroke} />
        <rect x="5" y="24" width="14" height="14" rx="3" fill="var(--green-bg)" stroke="var(--green)" {...stroke} />
        <rect x="25" y="24" width="14" height="14" rx="3" fill="var(--yellow-bg)" stroke="var(--yellow)" {...stroke} />
      </>
    ),
  },
  {
    num: '03',
    name: 'Token playground',
    text: 'Watch the analyzer cut and change your text.',
    to: '/tokens',
    ready: false,
    icon: (
      <>
        <rect x="3" y="15" width="11" height="14" rx="3" fill="var(--yellow-bg)" stroke="var(--yellow)" {...stroke} />
        <rect x="17" y="15" width="11" height="14" rx="3" fill="var(--yellow-bg)" stroke="var(--yellow)" {...stroke} />
        <rect x="31" y="15" width="10" height="14" rx="3" fill="var(--red-bg)" stroke="var(--red)" strokeDasharray="3 2" {...stroke} />
      </>
    ),
  },
  {
    num: '04',
    name: 'Query lab',
    text: 'Run a query and see how each score was built.',
    to: '/query',
    ready: false,
    icon: (
      <>
        <rect x="5" y="8" width="30" height="6" rx="3" fill="var(--blue)" />
        <rect x="5" y="19" width="22" height="6" rx="3" fill="var(--blue)" opacity=".7" />
        <rect x="5" y="30" width="13" height="6" rx="3" fill="var(--blue)" opacity=".45" />
      </>
    ),
  },
  {
    num: '05',
    name: 'Load monitor',
    text: 'Live CPU, memory, search queue and running searches.',
    to: '/load',
    ready: false,
    icon: (
      <>
        <polyline points="3,30 11,24 18,28 25,14 32,20 41,8" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="3" y1="38" x2="41" y2="38" stroke="var(--line)" {...stroke} />
      </>
    ),
  },
];

function CardBody({ card }: { card: ScreenCard }) {
  return (
    <>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        {card.icon}
      </svg>
      <span className="num">{card.num}</span>
      <h3>{card.name}</h3>
      <p>{card.text}</p>
      {!card.ready && <span className="soon">Coming soon</span>}
    </>
  );
}

export default function ScreenCards() {
  return (
    <ul className="cards">
      {SCREENS.map((card) => (
        <li key={card.num}>
          {card.ready ? (
            <Link className="card" to={card.to}>
              <CardBody card={card} />
            </Link>
          ) : (
            <div className="card off">
              <CardBody card={card} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
