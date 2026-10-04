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
| Field playground step-by-step tokens | `POST /<index>/_analyze` | `{"tokenizer": "<name>", "char_filter": ["<name>", ...], "filter": [<name or inline step>, ...], "text": "<typed text>", "explain": true}` |

The playground's `filter` array is the live, possibly-reordered list the user is trying. Each
entry is either a filter's real name (OpenSearch resolves it from the index's own settings, the
same as a normal analyzer would) or, when the user chose "Use a saved list" for a synonym step
(R10), an inline filter definition built from that saved list instead of the name. This is how a
cluster-only filter like a named synonym or stop filter is ever tried at all — nothing in this
app can replicate one without asking the cluster, and earlier design choices against doing so
(see "Decisions") undersold how useful a live call like this is: it lets the playground show the
*real* effect of any filter, known to this app or not.

Example request and response (shortened), reordering `lowercase` before a cluster filter named
`english_stop`:

```json
POST /products_v7/_analyze
{ "tokenizer": "standard", "filter": ["lowercase", "english_stop"],
  "text": "The Shoes", "explain": true }
```

```json
{ "detail": { "charfilters": [], "tokenizer": { "name": "standard", "tokens": [...] },
  "tokenfilters": [
    { "name": "lowercase", "tokens": [{ "token": "the", ... }, { "token": "shoes", ... }] },
    { "name": "english_stop", "tokens": [{ "token": "shoes", ... }] }
  ] } }
```

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
| `analyzePlaygroundStep(request, name, spec)` | `POST /<index>/_analyze` | `AnalyzeResponse` (same shape as `src/analysis/types.ts`, already used by spec 007) | surfaced as-is to the playground |

`spec` is `{ tokenizer: string, charFilters: string[], filters: (string \| StepDef)[], text: string }`
— each `filters` entry is a cluster filter's real name, except the one entry a user has
overridden with "Use a saved list" (R10), which is an inline `StepDef` instead.

(`tryAnalyzer`, built in task 3, was removed when R9 first landed in favour of a browser-only
engine; `analyzePlaygroundStep` now replaces that browser engine with real cluster calls —
see "Decisions" for why the earlier "browser is the only way to reorder" reasoning was wrong.)

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
| `FieldPlayground` | Full-screen per-field view: steps, per-step tokens, reorder, reset, synonym source choice, entity-collapse switch | one `Field` + its `Chain`; `analyzePlaygroundStep`; `useWordLists()` (spec 006) for saved synonym/entity lists |
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

## A field's analyzer playground (R9, R10)

Choosing "Try it" on a field opens `FieldPlayground`, a full-screen view inside
`ClusterOverviewScreen` (a state flag, not a new route — R9.6's "return to where you came from"
is then just closing the view, no URL/back-button bookkeeping needed). It starts from the same
resolved `Chain` already in `IndexDetail`'s `analyzers` map (from `getIndexDetail`/
`resolveAnalyzer`), which gives the starting tokenizer name, char filter names, and filter names
and order — but every actual run of the chain (typing text, reordering, toggling a choice) calls
`analyzePlaygroundStep` against the real cluster (R9.4), not a browser copy:

- `Chips` from `src/screens/MappingLab/Pieces.tsx` draws the token chips per step (R9.2) — the
  same picture the mapping lab already uses, now fed by a real `AnalyzeResponse` instead of one
  computed by `analyzeInBrowser`.
- Reordering (R9.3) only touches the `filters` array's order — moving one entry earlier or later
  by one position. Every reorder re-sends the whole `analyzePlaygroundStep` request with the new
  order; the response shows the real effect, including filters this app does not otherwise know
  about (`synonym_filter_hc`, a hand-configured `english_stop`, etc.).
- "Reset to the cluster's order" (R9.5) discards the edited order and the state from R10 below,
  and re-runs with the original `Chain`'s order and every filter referenced by name.
- The fixed sentence (R9.7) now says plainly that trying text, reordering, and the R10 choices
  below never change anything on the cluster — only true, since every call here is a `POST` to
  `_analyze`, which the read-only guard already allows and which OpenSearch itself treats as a
  read (no index, document, or setting is touched).

**R10: synonym source and entity collapsing.** For each `filters` entry that is a synonym-type
step (`def.type` is `synonym` or `synonym_graph`), and only when `useWordLists().list('synonym')`
has at least one saved file, `FieldPlayground` shows a two-way choice next to that step's pill:
"Use the cluster's file" (default — send the step as its real name, unchanged) or "Use a saved
synonym list" (send an inline `{ type: 'synonym', synonyms: enabledEntries('synonym') }` in that
array position instead — `enabledEntries` already returns the saved lines in the Solr format a
synonym filter expects, spec 006 code, unchanged). The same `useWordLists()` check for an entity
list (`list('entity')`) shows the "Collapse saved entities first" switch; when on, the playground
joins a saved entity phrase in the typed text with a character the standard tokenizer will not
split on before sending `text` to `analyzePlaygroundStep`, then — this is the part that was
wrong the first time this was built — maps that joined token's display string back to the
phrase's original spacing before it reaches `Chips` (R10.5), so the user sees `"ai supplychain"`
as one token, never a delimiter invented for this feature. Internally the request still needs
*some* non-splitting character to make the tokenizer treat the phrase as one piece; only the
*display* is restored to the original text.

## Decisions

- Build the field tree and analyzer pills by reusing `src/analysis/definition.ts` and `compare.ts`
  (written for spec 007) instead of writing a second mapping reader, because the shapes
  (`Field`, `Chain`) and the plain-sentence logic are already correct and tested.
  Other option: write overview-specific parsing — rejected, it would duplicate spec 007's code.
- Superseded twice. First (when R9 first landed): `tryAnalyzer` (task 3) and `TryItBox` (task 5)
  were removed in favour of a browser-only engine (`analyzeInBrowser`), reasoning that a live
  `/_analyze` call "cannot reorder filters". That reasoning was wrong — OpenSearch's `_analyze`
  accepts an explicit `tokenizer`/`char_filter`/`filter` body (already used elsewhere in this
  project, see `opensearch-api` skill reference) whose `filter` array can be given in *any* order
  and can mix real cluster filter names with inline overrides. Second (this round):
  `analyzeInBrowser` is dropped from the playground entirely in favour of `analyzePlaygroundStep`
  (a real cluster call per run), because the browser engine cannot know a cluster-only filter
  like a hand-named synonym filter at all — it would always show that step as an unknown
  passthrough, which is exactly the bug that prompted this change. The browser engine
  (`src/analysis/engine.ts`) stays in place for spec 007 (mapping lab), which has no real index
  to call and must simulate; it is just no longer used by R9/R10.
- Shard layout is a separate call (`getShardLayout`) rather than folded into `getIndexDetail`,
  because the Settings tab can be opened without needing it until that tab is actually chosen.
- The field playground (R9) is a full-screen state flag inside `ClusterOverviewScreen`, not a
  router route, because a field path can contain dots and the playground never needs to be a
  shareable/bookmarkable URL — closing it is simply "go back", with no history entry to manage.
  Other option: a route like `/overview/:index/fields/:path` — rejected as unneeded complexity
  for a view that is always entered and left from the same place.
- The synonym source choice (R10) is per-step (only shown on a synonym-type filter), not a
  whole-playground setting, because a chain can have other steps unrelated to word lists at all —
  a single on/off switch for the whole chain would be meaningless outside that one step.
- Entity collapsing (R10.4, R10.5) is a plain string replace on the typed text before the
  request is sent, not a real OpenSearch char filter, because there is no cluster-side filter
  type that can join arbitrary saved multi-word phrases the way a replace built from the user's
  exact saved list, generated fresh in the browser, can.
- The underscore first used to join a collapsed phrase leaked into the token *display*, which
  read as the app inventing cluster behaviour that was not real (the user asked, reasonably,
  "why is the cluster showing me an underscore?"). The join character is still needed internally
  — the standard tokenizer splits on whitespace, so the request sent to `_analyze` cannot contain
  the phrase's real spaces and still come back as one token — but it is only ever a transport
  detail now: `FieldPlayground` keeps a map from the joined form back to the original phrase and
  rewrites any token that matches before it reaches `Chips`, so nothing the user sees uses a
  character the real analyzer did not produce.

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
  - `analyzePlaygroundStep`: sends `tokenizer`/`char_filter`/`filter`/`text` as given, and
    returns the fake response unchanged (R9.4).
  - `FieldPlayground`: shows the steps and per-step tokens for a sample chain and text, from a
    fake `_analyze` response (R9.1, R9.2); moving a filter up or down re-sends the request with
    the new `filter` order (R9.3, R9.4); "Reset" restores the original order and re-sends it
    (R9.5); the fixed sentence is always present (R9.7); closing it calls back to `IndexDetail`
    (R9.6); a synonym-type step shows the cluster-file/saved-list choice only when a synonym
    list is saved, and picking "saved list" sends an inline `StepDef` in that filter's place
    (R10.1–R10.3); the entity switch shows only when an entity list is saved, turning it on
    changes the `text` sent for a phrase that matches a saved entity, and the matching token in
    the rendered result shows the original phrase (space), not the internal join character
    (R10.4, R10.5).
- By hand, against the local practice cluster (`dev/`):
  - Open `/overview`, confirm the `products` index appears with correct size/health.
  - Open a field that searches with a different analyzer than it was saved with (or add one to
    the practice mapping), confirm both "Saved with" and "Searched with" show, each with correct
    pills, including any cluster-only filter names (R4.3's fix this session).
  - Try a field's analyzer, reorder a filter, confirm the tokens change to match what the real
    cluster says for that order (compare against a manual `POST /<index>/_analyze` call with the
    same body).
  - Save a synonym list and an entity list in Word lists, then confirm the R10 choice/switch
    appear on a synonym-using field and behave as designed — in particular, confirm the collapsed
    entity token shows as the plain phrase, not with an underscore.
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
| R9.1 | `FieldPlayground` opens from `FieldTree`'s "Try it", shows step pills + text box |
| R9.2 | `FieldPlayground` per-step `Chips` from `analyzePlaygroundStep`'s `AnalyzeResponse` |
| R9.3 | `FieldPlayground` move-filter controls |
| R9.4 | `FieldPlayground` re-runs `analyzePlaygroundStep` with the edited `filter` order |
| R9.5 | `FieldPlayground` Reset button |
| R9.6 | `FieldPlayground` close/back control |
| R9.7 | `FieldPlayground` fixed "nothing on the cluster changes" sentence |
| R10.1 | `FieldPlayground` synonym-step choice, gated on `useWordLists().list('synonym')` |
| R10.2 | `FieldPlayground` sends the synonym step by name (default) |
| R10.3 | `FieldPlayground` sends an inline `StepDef` built from `enabledEntries('synonym')` |
| R10.4 | `FieldPlayground` "Collapse saved entities first" switch, gated on `list('entity')` |
| R10.5 | `FieldPlayground` text substitution before the request; display map restores original spacing before `Chips` |
| R10.6 | No call in R10.1–R10.5 is anything but a `POST /_analyze` (read-only guard already enforces this) |
