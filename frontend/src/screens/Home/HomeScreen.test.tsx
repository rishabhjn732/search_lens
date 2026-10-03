import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { demoHit } from './demoData';
import { READ_ONLY_SENTENCE } from './HowItWorks';
import { SCREENS } from './ScreenCards';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function onConnectPage() {
  return screen.getByRole('heading', { level: 1, name: 'Connect to a cluster' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Home page', () => {
  it('R5.1 shows the title, the connect button, the five screens, how it works and the read-only sentence', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('See why a document matched your search.');
    expect(screen.getByRole('link', { name: 'Connect to a cluster' })).toBeInTheDocument();

    const cards = within(screen.getByRole('region', { name: 'Five screens, one job' })).getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    expect(SCREENS.map((s) => s.name)).toEqual([
      'Connect',
      'Cluster overview',
      'Token playground',
      'Query lab',
      'Load monitor',
    ]);

    const how = screen.getByRole('region', { name: 'How it works' });
    expect(within(how).getAllByRole('listitem')).toHaveLength(3);

    expect(READ_ONLY_SENTENCE).toBe(
      'Search Lens only reads from your cluster. It never creates, changes or deletes anything.',
    );
    expect(screen.getByRole('region', { name: 'Safety' })).toHaveTextContent(READ_ONLY_SENTENCE);
  });

  it('R5.2 the "Connect to a cluster" button opens the connect screen', () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('link', { name: 'Connect to a cluster' }));

    expect(onConnectPage()).toBeInTheDocument();
  });

  it('R5.3 each card shows a name and one sentence; only built screens are links', () => {
    renderAt('/');
    const region = screen.getByRole('region', { name: 'Five screens, one job' });

    for (const card of SCREENS) {
      expect(within(region).getByRole('heading', { name: card.name })).toBeInTheDocument();
      expect(within(region).getByText(card.text)).toBeInTheDocument();
    }

    const links = within(region).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Connect'), expect.stringContaining('Cluster overview')]),
    );
    expect(links).toHaveLength(2);
    expect(within(region).getAllByText('Coming soon')).toHaveLength(3);
    for (const name of ['Token playground', 'Query lab', 'Load monitor']) {
      expect(within(region).queryByRole('link', { name: new RegExp(name) })).toBeNull();
    }
  });

  it('R5.3 the Connect card opens the connect screen', () => {
    renderAt('/');
    const region = screen.getByRole('region', { name: 'Five screens, one job' });

    fireEvent.click(within(region).getByRole('link', { name: /Connect/ }));

    expect(onConnectPage()).toBeInTheDocument();
  });

  it('R5.4 the example shows the query, the tokens run and shoe, and the score', () => {
    renderAt('/');
    const demo = screen.getByRole('figure', { name: /Running Shoes!/ });

    expect(within(demo).getByText('Running Shoes!')).toBeInTheDocument();
    // The last analyzer row holds the final tokens; "shoe" also appears highlighted in the hit title.
    const chips = (text: string) => within(demo).getAllByText(text).filter((el) => el.classList.contains('chip'));
    expect(chips('run')).toHaveLength(1);
    expect(chips('shoe')).toHaveLength(1);
    expect(within(demo).getByText('shoe', { selector: '.title b' })).toBeInTheDocument();
    expect(within(demo).getByText('!')).toHaveClass('r');
    expect(within(demo).getByText(demoHit._score.toFixed(2))).toBeInTheDocument();
  });

  it('R5.6 the Search Lens name in the header leads to the home page', () => {
    renderAt('/connect');
    expect(onConnectPage()).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Search Lens' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('See why a document matched your search.');
  });

  it('R5.8 showing the home page makes no network call', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    renderAt('/');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
