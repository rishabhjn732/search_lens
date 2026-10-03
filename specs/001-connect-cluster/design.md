# Design: connect to a cluster

Status: approved

## Overview

Search Lens runs only in the browser. There is no backend (decided 2026-10-03, see
`docs/steering/tech.md`).

The connect screen gives the URL, username and password to `ConnectionProvider`. It creates a
cluster client and makes two calls straight from the browser to the cluster: one for the version
and name, one for the health. If both work, the client stays in page memory and every screen uses
it. Nothing is written to browser storage, so a reload means connecting again (R2.4).

Every call goes through one function, `request(method, path, body)`. It first asks the read-only
guard. A refused call is never sent (R3.1). An allowed call gets the login header and a 5 second
time limit.

Real-life picture: you carry your own key to the building. Search Lens has a rule on its own hand:
it only turns door handles marked "read". Someone could break that rule by changing the tool,
so the safest key is one that only opens "read" doors anyway: a read-only cluster user (R3.3).

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

The cluster must allow calls from the page's address (CORS). The browser first sends an `OPTIONS`
"preflight" call, because the request has an `Authorization` header. The practice cluster in
`dev/docker-compose.yml` is set up for `http://localhost:5173` (task 9).

## Cluster code (`src/opensearch/`)

This folder is the only code that calls the cluster. Components never call `fetch`.

| File | Job |
|---|---|
| `client.ts` | `createClusterClient({ url, username, password })` returns `request(method, path, body?)` and `connect()`. `connect()` makes the two calls above and returns `{ cluster_name, version, distribution, status, number_of_nodes }`. |
| `guard.ts` | `isAllowed(method, path)`, from `.claude/skills/opensearch-api/reference.md`, section "Read-only guard". |
| `errors.ts` | `ClusterError` with `code` and `message`, and one function that builds each exact message. |

### How the password is kept

- `createClusterClient` turns the username and password into the `Authorization: Basic ...` header
  once and keeps it in a closure. The returned object has no `password` field, so it cannot show up
  when the object is logged or turned into JSON.
- The connect form's password field is cleared as soon as Connect is chosen.
- Calls use `credentials: "omit"` and send the header only to URLs that start with the URL the user
  entered (R2.3). `request` takes a path, not a full URL, so it cannot be pointed elsewhere.
- Nothing is written to `localStorage`, `sessionStorage`, cookies or IndexedDB, and nothing is
  logged to the console.

### Mapping problems to errors

| What happens | Code | Message |
|---|---|---|
| URL does not start with `http://` or `https://`, or has no host | `invalid_url` | "This is not a valid address. Use http:// or https://, for example https://localhost:9200." |
| Cluster answers 401 | `auth_failed` | "The username or password is wrong." |
| Cluster answers 403 | `forbidden` | "This user is not allowed to read cluster information." |
| No answer within 5 seconds (`AbortController`) | `timeout` | "The cluster at <url> did not answer in 5 seconds." |
| `fetch` throws (wrong address, network, untrusted certificate, or CORS) | `unreachable` | "Cannot reach the cluster at <url>." |
| The guard refuses the call | `read_only` | "Search Lens is read-only. This call would change the cluster." |
| Any other answer that is not 2xx | `cluster_error` | "The cluster answered with error <status>." The cluster's own error body is kept on the error, so a screen can draw it. |

Browsers do not tell a web page why a call failed, so the four causes of `unreachable` cannot be
told apart. The connect screen lists all of them with what to do (R1.4).

### Read-only guard

Allowed: `GET`, `HEAD`, and `POST` only when the path ends with one of the read-style APIs in the
reference. Everything else, including every `PUT`, `DELETE` and `PATCH`, is refused before `fetch`.

## Screens and components

| Component | What it shows | Data it needs |
|---|---|---|
| `ConnectScreen` (`src/screens/Connect/`) | The form, the working state, error messages with the cause list for `unreachable`, the read-only user tip (R3.3), and the cluster facts after success | `useConnection()` |
| `ConnectionProvider` (`src/components/`) | Holds the client and the cluster facts in memory for all screens. Asks for `GET /_cluster/health` every 15 seconds while connected. | the client |
| `useConnection()` | `{ state, facts, connect(details), disconnect(), request }`. `state` is `not_connected`, `connecting`, `connected` or `lost`. | `ConnectionProvider` |
| `ConnectionBadge` (`src/components/`) | In the header: cluster name and a coloured health word, Disconnect button; "Connection lost" and "Connect again" when lost | `useConnection()` |

### Home page

The home page is the first thing the user sees. It is drawn only from fixed text and fixed
example data in the frontend, so it makes no cluster call (R5.8).
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

## Errors and empty states

| Situation | What the user sees |
|---|---|
| Any connect error | The message from the table above, under the form. The form keeps the URL and username, and clears the password. |
| `unreachable` | The message and a list: check the address and the network; open the URL in a new tab and accept the certificate (with a link that opens it); allow this page's address in the cluster's CORS settings. |
| Health turns `red` or `yellow` | The badge shows the word and colour. No pop-up. |
| A health check fails with `unreachable` or `timeout` while connected | `state` becomes `lost`. The badge shows "Connection lost" and a "Connect again" button. |

## Decisions

- **Browser-only, no backend.** Chosen by the user on 2026-10-03, so there is no server to run.
  Other option: a small Python backend that keeps the password and runs the guard (it was built as
  task 1 and then removed). Costs of this choice: each cluster must allow CORS; the password is in
  page memory; the guard can be skipped by someone who edits the page, hence R3.3.
- **No Vite proxy to the cluster in development.** It would hide CORS problems that every real
  cluster has. Other option: proxy `/os` to the practice cluster.
- **Login header kept in a closure**, so the password is not a field on any object.
  Other option: keep `{ url, username, password }` in React state.
- The badge asks for health every 15 seconds, because health should stay fresh on every screen
  without each screen doing its own check. Other option: check only when a screen opens.
- Pages use `react-router-dom`, because there will be six pages, and the browser's back button
  and links like `/connect` should work. Other option: one state value in `App` that picks the screen.
- Fonts come from npm packages (`@fontsource/...`), because the tool may run on a network with no
  internet. Other option: the Google Fonts link the prototype uses.

## Test plan

All tests use a fake `fetch` (`vi.stubGlobal`). No test calls a real cluster.

- Guard: every allowed method and path, and refused ones (`PUT`, `DELETE`, `PATCH`, `POST` to a
  write API). A refused call never reaches `fetch`.
- Client: each row of the error table, with the exact message; the `Authorization` header is sent;
  `credentials` is `omit`; the 5 second timeout; `connect()` returns the facts from the two answers.
- Password: after connect and after each error, the password is not in any error message, not in
  `JSON.stringify` of the client or the error, not in `console` calls, and not in `localStorage`,
  `sessionStorage` or `document.cookie`.
- Provider: states `not_connected`, `connecting`, `connected`, `lost`; disconnect forgets the
  client; a new render (like a reload) starts as `not_connected`.
- Screens: the form states (empty, working, success, each error), the cause list, the read-only tip,
  the password field empty after Connect; the badge states.
- Home page: all parts of R5.1 are on the page; the button and the Connect card lead to
  `/connect`; the four other cards say "Coming soon" and are not links; the logo leads to `/`;
  the demo shows "run", "shoe" and the score from `demoData.ts`; no `fetch` call happens.
- By hand: connect to the practice cluster; with a wrong password; with the cluster stopped;
  before accepting the certificate; with CORS turned off.
- By hand, home page: compare with the prototype; turn on "reduce motion" in the system settings
  and check nothing moves; make the window narrow and check there is one column and no sideways scroll.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `connect()`, `ConnectScreen` success state |
| R1.2 | error mapping `auth_failed` |
| R1.3 | error mapping `timeout`, 5 second `AbortController` |
| R1.4 | error mapping `unreachable`, cause list on `ConnectScreen` |
| R1.5 | `invalid_url` check before any call |
| R1.6 | error mapping `forbidden` |
| R1.7 | `connecting` state, button disabled |
| R2.1 | client in `ConnectionProvider` memory only |
| R2.2 | header in a closure, no storage, no console, password tests |
| R2.3 | `request` takes a path on the entered URL only, `credentials: "omit"` |
| R2.4 | nothing stored, provider starts as `not_connected` |
| R3.1 | `guard.ts` before `fetch`, `read_only` error |
| R3.2 | guard allow-list |
| R3.3 | read-only user tip on `ConnectScreen` |
| R4.1 | `ConnectionBadge` in `AppHeader` |
| R4.2 | `disconnect()` forgets the client, back to `/connect` |
| R4.3 | `lost` state, badge "Connection lost" |
| R5.1 | `HomeScreen`, `ScreenCards`, `HowItWorks` |
| R5.2 | "Connect to a cluster" link to `/connect`, router |
| R5.3 | `ScreenCards` with the `ready` flag |
| R5.4 | `QueryDemo` with `demoData.ts` |
| R5.5 | reduced-motion CSS block |
| R5.6 | `AppHeader` logo link to `/` |
| R5.7 | one-column CSS below 900 pixels |
| R5.8 | home page uses fixed data only; test that no `fetch` happens |
