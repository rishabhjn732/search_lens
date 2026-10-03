import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionProvider } from '../../components/ConnectionProvider';
import ConnectScreen from './ConnectScreen';

const ROOT_BODY = {
  name: 'node-1',
  cluster_name: 'docker-cluster',
  version: { distribution: 'opensearch', number: '2.19.0' },
};
const HEALTH_BODY = { cluster_name: 'docker-cluster', status: 'green', number_of_nodes: 1 };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A stand-in for the real overview screen (its own tests cover that screen), so this
// file can check that a successful connect navigates there (R1.1) without pulling in
// ClusterOverviewScreen's own cluster calls.
function renderScreen() {
  return render(
    <ConnectionProvider>
      <MemoryRouter initialEntries={['/connect']}>
        <Routes>
          <Route path="/connect" element={<ConnectScreen />} />
          <Route path="/overview" element={<p>Cluster overview page</p>} />
        </Routes>
      </MemoryRouter>
    </ConnectionProvider>,
  );
}

function fillForm(url: string, username: string, password: string) {
  fireEvent.change(screen.getByLabelText('Cluster URL'), { target: { value: url } });
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /connect/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConnectScreen', () => {
  it('empty state: shows the form, the read-only tip, and an enabled Connect button', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Connect to a cluster' })).toBeInTheDocument();
    expect(
      screen.getByText('For the most safety, connect with a user that can only read.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  });

  it('R1.7 working state: shows it is working and disables a second Connect', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => (resolveFetch = resolve))),
    );
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    expect(await screen.findByRole('button', { name: 'Connecting…' })).toBeDisabled();

    resolveFetch(jsonResponse(200, ROOT_BODY));
  });

  it('R1.1 success: navigates to the cluster overview screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ROOT_BODY))
        .mockResolvedValueOnce(jsonResponse(200, HEALTH_BODY)),
    );
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    expect(await screen.findByText('Cluster overview page')).toBeInTheDocument();
  });

  it('R1.8 connects with no username or password, for a cluster with no login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ROOT_BODY))
        .mockResolvedValueOnce(jsonResponse(200, HEALTH_BODY)),
    );
    renderScreen();
    fillForm('https://localhost:9200', '', '');
    submit();

    expect(await screen.findByText('Cluster overview page')).toBeInTheDocument();
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('R1.9 credentials_incomplete: shows the message when only one of username/password is filled in', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderScreen();
    fillForm('https://localhost:9200', 'admin', '');
    submit();

    expect(
      await screen.findByText('Enter both username and password, or leave both empty.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('R1.5 invalid_url: says so before any call is made', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderScreen();
    fillForm('not-a-url', 'admin', 'secret');
    submit();

    expect(
      await screen.findByText(
        'This is not a valid address. Use http:// or https://, for example https://localhost:9200.',
      ),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('R1.2 auth_failed: shows the exact message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'wrong');
    submit();

    expect(await screen.findByText('The username or password is wrong.')).toBeInTheDocument();
  });

  it('R1.6 forbidden: shows the exact message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {})));
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    expect(
      await screen.findByText('This user is not allowed to read cluster information.'),
    ).toBeInTheDocument();
  });

  it('R1.3 timeout: shows the exact message with the url', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(
      screen.getByText('The cluster at https://localhost:9200 did not answer in 5 seconds.'),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('R1.4 unreachable: shows the message and the cause list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    expect(await screen.findByText('Cannot reach the cluster at https://localhost:9200.')).toBeInTheDocument();
    expect(screen.getByText('Check the address and the network.')).toBeInTheDocument();
    expect(screen.getByText(/Allow this page's address/)).toBeInTheDocument();
  });

  it('R2.2 the password field is empty right after Connect is chosen', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    renderScreen();
    fillForm('https://localhost:9200', 'admin', 'secret');
    submit();

    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});
