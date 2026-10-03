import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { resetWordListStoreForTests } from '../../wordlists/useWordLists';

const file = (name: string, text: string) => new File([text], name, { type: 'text/plain' });

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function section() {
  return screen.getByRole('region', { name: 'Bring your own word lists' });
}

beforeEach(() => {
  localStorage.clear();
  resetWordListStoreForTests();
});

describe('Home page word lists section', () => {
  it('R5.1 shows four boxes, each with an example of its file', () => {
    renderHome();
    const s = section();

    for (const title of ['Entities', 'Protected words', 'Synonyms', 'Hunspell dictionary']) {
      expect(within(s).getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(within(s).getByText(/# entity\.txt, one phrase per line/)).toBeInTheDocument();
    expect(within(s).getByText(/# synonyms\.txt, Solr format/)).toBeInTheDocument();
    expect(within(s).getByLabelText('Choose .aff and .dic for Hunspell dictionary')).toHaveAttribute('multiple');
  });

  it('R5.2 a good file is saved and the box links to the Word lists page on that tab', async () => {
    renderHome();

    fireEvent.change(screen.getByLabelText('Choose file for Entities'), {
      target: { files: [file('company.txt', 'ai supplychain\ngenerative ai\ngenerative ai\n')] },
    });

    const box = screen.getByTestId('drop-entity');
    expect(await within(box).findByText(/✓ Saved company\.txt: 2 entities \(1 duplicate line skipped\)\./)).toBeInTheDocument();
    expect(box).toHaveClass('has');

    fireEvent.click(within(box).getByRole('link', { name: 'See it in Word lists →' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Word lists' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Entities/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^company\.txt/ })).toBeInTheDocument();
  });

  it('R5.2 a bad file is not saved and the box shows the first problem', async () => {
    renderHome();

    fireEvent.change(screen.getByLabelText('Choose file for Synonyms'), {
      target: { files: [file('bad.txt', 'tv =>\nsofa\n')] },
    });

    const box = screen.getByTestId('drop-synonym');
    expect(
      await within(box).findByText(
        '✕ Not saved. Line 1: Put words on both sides of "=>", for example: tv => television (1 more problem)',
      ),
    ).toBeInTheDocument();
    expect(box).toHaveClass('bad');
    expect(within(box).queryByRole('link')).toBeNull();
  });

  it('R5.2 the Hunspell box takes the .aff and .dic together', async () => {
    renderHome();

    fireEvent.change(screen.getByLabelText('Choose .aff and .dic for Hunspell dictionary'), {
      target: { files: [file('en_GB.aff', 'SET UTF-8\n'), file('en_GB.dic', '1\nrun/S\n')] },
    });

    expect(await within(screen.getByTestId('drop-hunspell')).findByText(/✓ Saved en_GB: 1 word\./)).toBeInTheDocument();
  });

  it('R5.3 shows the "iPhone sneakers" example with a legend', () => {
    renderHome();
    const pic = within(section()).getByRole('figure', { name: /iPhone sneakers/ });

    expect(within(pic).getByText('Without lists')).toBeInTheDocument();
    expect(within(pic).getByText('With your lists')).toBeInTheDocument();
    expect(within(pic).getByText('iphon')).toBeInTheDocument();
    expect(within(pic).getByText('protected word')).toBeInTheDocument();
  });
});
