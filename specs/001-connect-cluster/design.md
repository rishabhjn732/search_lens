# Design: connect to a cluster

Status: approved

## Overview

The connect screen sends the URL, username, password and the "skip certificate check" choice to the backend.
The backend makes two calls to the cluster: one for the version and name, one for the health.
If both work, the backend keeps the connection in memory under a random session id and gives
that id to the browser in a cookie that scripts cannot read. The browser forgets the password.

Every later request from the browser carries the cookie. The backend looks up the connection
and forwards the call to the cluster through a guard that only lets read calls pass.

Real-life picture: you show your ID once at the building entrance and get a visitor card.
After that you only show the card. The guard at each door checks the card and only opens
doors that visitors may use.

## OpenSearch calls

| Purpose | Method and path | Important parameters |
|---|---|---|
| Name and version | `GET /` | none |
| Health and node count | `GET /_cluster/health` | none |

Example responses (shortened):

```json
{ "name": "node-1", "cluster_name": "docker-cluster",
  "version": { "distribution": "opensearch", "number": "2.19.0" } }
```

```json
{ "cluster_name": "docker-cluster", "status": "green", "number_of_nodes": 1 }
```

## Backend

| Route | Request | Success response | Errors |
|---|---|---|---|
| `POST /api/connection` | `{ url, username, password, verify_tls }` | 200 `{ data: { cluster_name, version, distribution, status, number_of_nodes } }` and a session cookie | `invalid_url` 422, `auth_failed` 401, `forbidden` 403, `unreachable` 502, `timeout` 504, `tls_untrusted` 502 |
| `GET /api/connection` | cookie | 200 `{ data: { connected, url, username, cluster_name, status } }` | `connection_lost` 502 |
| `DELETE /api/connection` | cookie | 204 | none |
| `ANY /api/os/{path}` | cookie, any body | the cluster's answer, unchanged | `not_connected` 409, `read_only` 403, plus the errors above |

Error bodies have the shape `{ "error": { "code": "...", "message": "..." } }`.
The `message` is the exact sentence from the requirements.

### Connection store

- A dictionary in memory: session id to connection.
- A connection holds the URL, username, password, `verify_tls` and one `httpx.AsyncClient` with a 5 second timeout.
- The session id is 32 random bytes from `secrets.token_urlsafe`.
- The cookie is named `sl_session`, with `HttpOnly` and `SameSite=Strict`.
- The connection's text form (`__repr__`) hides the password, so it cannot leak through a log line.
- Request bodies are never logged.

### Mapping cluster problems to errors

| What happens | Error code |
|---|---|
| URL does not start with `http://` or `https://`, or has no host | `invalid_url` |
| Cluster answers 401 | `auth_failed` |
| Cluster answers 403 | `forbidden` |
| Name cannot be resolved, or connection refused | `unreachable` |
| No answer within 5 seconds | `timeout` |
| Certificate check fails and `verify_tls` is true | `tls_untrusted` |

### Read-only guard

One function decides if a method and path may pass. The allowed list is in
`.claude/skills/opensearch-api/reference.md`, section "Read-only guard".
The guard runs before any call leaves the backend.

## Frontend

| Component | What it shows | Data it needs |
|---|---|---|
| `ConnectScreen` | The form, the working state, error messages, the "Skip certificate check" box | nothing at start |
| `ConnectionBadge` | Cluster name and a coloured health word in the header; Disconnect button | `GET /api/connection` every 15 seconds |
| `ConnectionProvider` | Holds "connected or not" for all screens | same |
| `api/client.ts` | One place for all backend calls; turns error bodies into typed errors | none |

### Home page

The home page is the first thing the user sees. It is drawn only from fixed text and fixed
example data in the frontend, so it makes no backend or cluster call (R5.8).
The look comes from `prototypes/home/a-clean-lab.html`, without the "Bring your own word lists"
section. The prototype is a picture to copy, not code to paste.

| Address | What it shows |
|---|---|
| `/` | `HomeScreen` |
| `/connect` | `ConnectScreen` |

| Component | What it shows | Data it needs |
|---|---|---|
| `AppHeader` (`src/components/`) | Logo and "Search Lens" (a link to `/`), the menu, and the place for `ConnectionBadge` | none |
| `HomeScreen` (`src/screens/Home/`) | Title, short text, "Connect to a cluster" button (link to `/connect`), then the parts below | none |
| `QueryDemo` (`src/screens/Home/`) | The example: query, split, lowercase, stem, top hit with a score bar, shown one row after another | a fixed example in `demoData.ts` |
| `ScreenCards` (`src/screens/Home/`) | Five cards with an icon, number, name and one sentence | a fixed list of the five screens |
| `HowItWorks` (`src/screens/Home/`) | Three steps and the read-only sentence | none |

The fixed example in `demoData.ts` uses the same shape as a real OpenSearch `_analyze` answer
with `explain: true` (a list of steps, each with a `tokens` list), plus one hit with `_score`.
So `QueryDemo` already reads the real shape, and the Token playground can reuse it later.

```ts
// shortened
{ detail: { tokenizer: { name: "standard", tokens: [{ token: "Running" }, { token: "Shoes" }] },
            tokenfilters: [ { name: "lowercase", tokens: [{ token: "running" }, { token: "shoes" }] },
                            { name: "stemmer",   tokens: [{ token: "run" },     { token: "shoe" }] } ] },
  hit: { _id: "1042", _score: 7.84, _source: { title: "RunFast trail shoe, size 42" } } }
```

Each screen card has a `ready` flag. Only Connect is `ready` in this spec. A card that is not
ready is plain text with a "Coming soon" label, not a link (R5.3). Later specs turn their card on.

Movement is CSS only. One `@media (prefers-reduced-motion: reduce)` block stops it and shows the
last state of every row (R5.5). Below 900 pixels wide, the grids become one column (R5.7).

Colours and fonts move from the prototype into `src/styles/theme.css` as CSS variables, so
every screen shares them. Fonts (Atkinson Hyperlegible, JetBrains Mono) are installed as npm
packages, so the tool works without internet.

The password lives only in the form's state and is cleared as soon as the request is sent.
Nothing is written to `localStorage` or `sessionStorage`.

In development, Vite forwards `/api` to `http://localhost:8000`, so the cookie belongs to one address.

## Errors and empty states

| Situation | What the user sees |
|---|---|
| Any connect error | The sentence from the requirements, under the form. The form keeps the URL and username. |
| `tls_untrusted` | The explanation, and the "Skip certificate check" box is highlighted. |
| Health turns `red` or `yellow` | The badge shows the word and colour. No pop-up. |
| `connection_lost` | The badge shows "Connection lost" and a "Connect again" button. |

## Decisions

- Session id in an `HttpOnly` cookie, because page scripts then cannot read it.
  Other option: a token kept in JavaScript memory.
- Connections kept in memory only, because requirement R2.4 wants them gone after a restart.
  Other option: an encrypted file.
- The badge asks the backend every 15 seconds, because health should stay fresh on every screen
  without each screen doing its own check. Other option: check only when a screen opens.
- Pages use `react-router-dom`, because there will be six pages, and the browser's back button
  and links like `/connect` should work. Other option: one state value in `App` that picks the screen.
- Fonts come from npm packages (`@fontsource/...`), because the tool may run on a network with no
  internet. Other option: the Google Fonts link the prototype uses.

## Test plan

- Automatic, backend: each row of the error mapping table, with a fake transport; the guard with
  allowed and refused calls; a test that the password does not appear in logs or in `repr`.
- Automatic, frontend: the form states (empty, working, each error), the badge states.
- Automatic, home page: all parts of R5.1 are on the page; the button and the Connect card lead to
  `/connect`; the four other cards say "Coming soon" and are not links; the logo leads to `/`;
  the demo shows "run", "shoe" and the score from `demoData.ts`; no `fetch` call happens.
- By hand: connect to the practice cluster, with a wrong password, with the cluster stopped,
  and with the certificate check on and off.
- By hand, home page: compare with the prototype; turn on "reduce motion" in the system settings
  and check nothing moves; make the window narrow and check there is one column and no sideways scroll.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `POST /api/connection`, `ConnectScreen` success state |
| R1.2 | error mapping `auth_failed` |
| R1.3 | error mapping `unreachable` and `timeout`, 5 second client timeout |
| R1.4 | error mapping `tls_untrusted`, `verify_tls` field, highlighted box |
| R1.5 | `invalid_url` check before any call |
| R1.6 | error mapping `forbidden` |
| R1.7 | `ConnectScreen` working state, button disabled |
| R2.1 | connection store in memory |
| R2.2 | hidden `repr`, no body logging, log test |
| R2.3 | form state cleared, no browser storage |
| R2.4 | memory-only store |
| R3.1 | read-only guard, `read_only` error |
| R3.2 | guard allow-list |
| R4.1 | `ConnectionBadge` in the app header |
| R4.2 | `DELETE /api/connection`, client closes, store entry removed |
| R4.3 | `connection_lost` error, badge "Connection lost" state |
| R5.1 | `HomeScreen`, `ScreenCards`, `HowItWorks` |
| R5.2 | "Connect to a cluster" link to `/connect`, router |
| R5.3 | `ScreenCards` with the `ready` flag |
| R5.4 | `QueryDemo` with `demoData.ts` |
| R5.5 | reduced-motion CSS block |
| R5.6 | `AppHeader` logo link to `/` |
| R5.7 | one-column CSS below 900 pixels |
| R5.8 | home page uses fixed data only; test that no `fetch` happens |
