# Design: cluster overview

Status: approved

## Overview

After a successful connect, the app shows the Cluster Overview screen. It first draws a bar
chart of the 10 biggest indexes (`GET /_cat/indices`), with a search box to find any other index
by name. Choosing an index opens a detail view with two tabs: Fields (a tree built from
`GET /<index>/_mapping` and `_settings`, reusing the mapping-lab analysis code from spec 007 to
describe each field and draw analyzer pills) and Settings (a picture of shards and replicas built
from `_cat/shards` and `_settings`). Nothing reloads by itself; a Refresh button reloads the list,
and, if open, the current index's detail. A permission error on one call shows a small message in
that one part of the screen and leaves the rest working.

## OpenSearch calls

| Purpose | Method and path | Important parameters |
|---|---|---|
| Index list, size, docs, health | `GET /_cat/indices?format=json&bytes=b&h=index,health,status,docs.count,store.size` | — |
| Index fields | `GET /<index>/_mapping` | — |
| Index settings and analyzers | `GET /<index>/_settings` | — |
| Shard placement | `GET /_cat/shards?format=json&h=index,shard,prirep,state,node` | filtered to the chosen index client-side |

(The field analyzer "Try it" view (R9) computes tokens in the browser — see below — and makes no
cluster call of its own.)

Example `_cat/indices` response (shortened):

```json
[
  { "index": "products_v7", "health": "green", "status": "open",
    "docs.count": "48213", "store.size": "92340112" },
  { "index": ".kibana_1", "health": "green", "status": "open",
    "docs.count": "12", "store.size": "40112" }
]
```

Example `_mapping` response (shortened):

```json
{ "products_v7": { "mappings": { "properties": {
  "title": { "type": "text", "analyzer": "product_text" },
  "brand": { "type": "keyword" }
} } } }
```

Example `_cat/shards` response row:

```json
{ "index": "products_v7", "shard": "0", "prirep": "p", "state": "STARTED", "node": "node-1" }
```

An unassigned shard has `"state": "UNASSIGNED"` and `"node": null`.

## Cluster code (`src/opensearch/`)

| Function | What it calls | What it returns | Errors |
|---|---|---|---|
| `listIndexSummaries(request)` | `GET /_cat/indices` | `IndexSummary[]` (`name`, `health`, `docsCount`, `sizeBytes`, `isSystem`) sorted by size, descending | `forbidden` for R7.2 |
| `getIndexDetail(request, name)` | `GET /<index>/_mapping`, `GET /<index>/_settings` | `{ fields: Field[], analyzers: Record<string, Chain>, shards: null \| ShardLayout, settings: { shards, replicas, refreshInterval } }` | each of the two calls is caught on its own; a `forbidden` on one leaves the other's data in place (R7.1) |
| `getShardLayout(request, name)` | `GET /_cat/shards`, filtered to `name` | `ShardLayout` (`{ node: string \| null, shards: { shard: string, kind: 'primary' \| 'replica', assigned: boolean }[] }[]`) | `forbidden` for R7.1 |

(`tryAnalyzer`, built in task 3, is removed in the task that adds R9 — the field playground
computes tokens in the browser instead of asking the cluster.)

`getIndexDetail` builds `Field[]` with `listFields(mappings, analysis)` and each field's analyzer
`Chain` with `resolveAnalyzer(name, analysis)` — both already written in `src/analysis/definition.ts`
for spec 007 (mapping lab). The plain sentence per field (R4.2) and the pill labels (R4.3) reuse
`plainChain` from `src/analysis/compare.ts`. No new analysis code is written.

## Frontend

| Component | What it shows | Data it needs |
|---|---|---|
| `ClusterOverviewScreen` (`src/screens/ClusterOverview/`) | The screen: chart, search box, Refresh button, and the open index's detail panel | `listIndexSummaries` on mount; routed at `/overview` |
| `IndexChart` | Bar chart of the top 10, sort toggle (size / documents), system-index and extra-index counts | `IndexSummary[]` |
| `IndexSearch` | Search box and matching-name list | `IndexSummary[]` (all names, including system) |
| `IndexDetail` | Tabs "Fields" and "Settings" for the chosen index | `getIndexDetail`, `getShardLayout` |
| `FieldTree` | The field tree, one row per field with its sentence, pills and a "Try it" button | `Field[]`, `Chain` map |
| `FieldPlayground` | Full-screen per-field view: steps, per-step tokens, reorder, reset | one `Field` + its `Chain` |
| `ShardMap` | Nodes with their shard boxes, unassigned ones in red | `ShardLayout` |

`ConnectScreen` calls `navigate('/overview')` after `connect()` resolves (R1.1). The home page's
Cluster overview card (already a "Coming soon" placeholder, R5.3 of spec 001) becomes a link to
`/overview`; if not connected, `/overview` itself redirects to `/connect` (R1.2 only concerns the
already-connected case, so no new requirement is needed for the not-connected case — it reuses the
existing "ask to connect" behaviour other screens would need, noted here as a design decision).

## Errors and empty states

| Situation | What the user sees |
|---|---|
| No indexes at all | "This cluster has no indexes yet." instead of the chart (R2.5) |
| Search text matches nothing | "No index matches '<text>'." (R3.4) |
| Can't read `_cat/indices` | "This user cannot read the list of indexes." for the whole screen (R7.2) |
| Can't read one index's mapping or settings | "You do not have permission to see this." inside that tab only (R7.1) |
| A field has no single clear type (e.g. unreadable) | "This field could not be read." for that row only (R4.5) |
| Connection lost mid-call | Same lost-connection banner and "connect again" offer as spec 001 R4.3 (R8.2) |
| List or detail loading | A spinner/placeholder in that part of the screen (R8.1) |

## A field's analyzer playground (R9)

Choosing "Try it" on a field opens `FieldPlayground`, a full-screen view inside
`ClusterOverviewScreen` (a state flag, not a new route — R9.6's "return to where you came from"
is then just closing the view, no URL/back-button bookkeeping needed). It starts from the same
resolved `Chain` already in `IndexDetail`'s `analyzers` map (from `getIndexDetail`/
`resolveAnalyzer`) — no extra cluster call to open it.

Everything inside the playground runs in the browser, reusing spec 007 (mapping lab) code:

- `analyzeInBrowser(chain, text)` from `src/analysis/engine.ts` computes the step-by-step
  `AnalyzeResponse` (char filter output, tokenizer output, each token filter's output) for
  whatever `Chain` is currently shown — the real one, or a reordered copy.
- `Steps` and `Chips` from `src/screens/MappingLab/Pieces.tsx` draw the step pills and the token
  chips per step (R9.1, R9.2) — the same pictures the mapping lab already uses.

Reordering (R9.3, R9.4) only touches `chain.filters` (token filters) — moving one earlier or
later by one position, exactly like fixing an off-by-one in a list. The screen keeps the edited
order in its own state; "Reset to the cluster's order" (R9.5) just discards that state and falls
back to the original `Chain` from `analyzers`. Nothing is sent to the cluster, and the heading
"These steps run in your browser — the field's real analyzer on the cluster is not changed." is
always shown (R9.7).

## Decisions

- Build the field tree and analyzer pills by reusing `src/analysis/definition.ts` and `compare.ts`
  (written for spec 007) instead of writing a second mapping reader, because the shapes
  (`Field`, `Chain`) and the plain-sentence logic are already correct and tested.
  Other option: write overview-specific parsing — rejected, it would duplicate spec 007's code.
- Superseded by R9: "Try it" no longer calls the real cluster's `/_analyze` per keystroke.
  `tryAnalyzer` (task 3) and `TryItBox` (task 5) are removed — the field playground reuses the
  already-resolved `Chain` and the browser engine instead, which is also what makes reordering
  possible at all (a live `/_analyze` call cannot reorder filters; see below).
- Shard layout is a separate call (`getShardLayout`) rather than folded into `getIndexDetail`,
  because the Settings tab can be opened without needing it until that tab is actually chosen.
- The field playground (R9) is a full-screen state flag inside `ClusterOverviewScreen`, not a
  router route, because a field path can contain dots and the playground never needs to be a
  shareable/bookmarkable URL — closing it is simply "go back", with no history entry to manage.
  Other option: a route like `/overview/:index/fields/:path` — rejected as unneeded complexity
  for a view that is always entered and left from the same place.
- Filter reordering reuses the browser analysis engine (`analyzeInBrowser`) instead of calling
  `_analyze` again per reorder, because OpenSearch's `_analyze` endpoint cannot run filters in an
  order different from how they are defined on the index — there is no server-side way to ask
  "what if filter 2 ran before filter 1". The browser copy is the only way to show that at all.

## Test plan

- Automatic (fake `fetch`, Vitest + React Testing Library):
  - `listIndexSummaries`: sorts by size, flags dotted names as system, counts the rest (R2.1–R2.4).
  - `getIndexDetail`: builds `Field[]` and `Chain`s from a sample mapping/settings pair; one call
    failing with 403 still returns the other's data (R7.1).
  - `getShardLayout`: marks `UNASSIGNED` rows as `assigned: false` (R5.2).
  - `IndexSearch`: filters a fixed name list, shows the no-match message (R3.2, R3.4).
  - `ClusterOverviewScreen`: empty-index response shows the empty message (R2.5); Refresh button
    re-calls `listIndexSummaries` and does not call it on a timer (R6.1–R6.4); a forbidden list
    call shows the whole-screen message (R7.2).
  - `ConnectScreen`: a successful `connect()` call navigates to `/overview` (R1.1).
  - `FieldPlayground`: shows the steps and per-step tokens for a sample chain and text (R9.1,
    R9.2); moving a filter up or down changes the shown tokens without any `fetch` call (R9.3,
    R9.4); "Reset" restores the original order (R9.5); the browser-only sentence is always
    present (R9.7); closing it calls back to `IndexDetail` (R9.6).
- By hand, against the local practice cluster (`dev/`):
  - Open `/overview`, confirm the `products` index appears with correct size/health.
  - Open its Fields tab, try a field's analyzer with real text, confirm tokens match what the
    token playground would show for the same analyzer.
  - Open its Settings tab, confirm shard count and replica picture match `_cat/shards`.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `ConnectScreen` navigates to `/overview` on success |
| R1.2 | `/overview` route behaviour, home page card link |
| R2.1 | `IndexChart`, `listIndexSummaries` |
| R2.2 | `IndexChart` sort toggle |
| R2.3 | `listIndexSummaries` (`isSystem` flag and count) |
| R2.4 | `listIndexSummaries` count beyond top 10 |
| R2.5 | `ClusterOverviewScreen` empty state |
| R3.1 | `IndexSearch` |
| R3.2 | `IndexSearch` filtering |
| R3.3 | `IndexSearch` / `IndexChart` selection opens `IndexDetail` |
| R3.4 | `IndexSearch` no-match message |
| R4.1 | `FieldTree`, `listFields` |
| R4.2 | `FieldTree` row sentence, using the field's full `path` |
| R4.3 | `FieldTree` pills via `resolveAnalyzer` |
| R4.4 | `FieldTree` "Try it" button opens `FieldPlayground` |
| R4.5 | `FieldTree` per-row error state |
| R5.1 | `ShardMap`, `getShardLayout` |
| R5.2 | `ShardMap` unassigned styling |
| R5.3 | `IndexDetail` Settings tab plain-words settings |
| R6.1 | `ClusterOverviewScreen` load on mount |
| R6.2 | `ClusterOverviewScreen` Refresh button |
| R6.3 | `ClusterOverviewScreen` Refresh handler |
| R6.4 | No interval/timer in `ClusterOverviewScreen` (contrast with `ConnectionProvider`'s own health poll, which is unrelated) |
| R7.1 | `getIndexDetail` per-call error handling, `IndexDetail` tab-level message |
| R7.2 | `ClusterOverviewScreen` whole-screen message |
| R8.1 | Loading state in `ClusterOverviewScreen` / `IndexDetail` |
| R8.2 | Reuses spec 001 R4.3 lost-connection banner |
| R9.1 | `FieldPlayground` opens from `FieldTree`'s "Try it", shows `Steps` + text box |
| R9.2 | `FieldPlayground` per-step `Chips` from `analyzeInBrowser` |
| R9.3 | `FieldPlayground` move-filter controls |
| R9.4 | `FieldPlayground` re-runs `analyzeInBrowser` on the edited chain |
| R9.5 | `FieldPlayground` Reset button |
| R9.6 | `FieldPlayground` close/back control |
| R9.7 | `FieldPlayground` fixed browser-only sentence |
