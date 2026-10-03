import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows a header with the tool name', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toHaveTextContent('Search Lens');
  });

  it('opens on the home page', () => {
    render(<App />);

    expect(screen.getByRole('main')).toHaveTextContent('See why a document matched your search.');
  });
});
