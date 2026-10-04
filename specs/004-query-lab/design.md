# Design: query lab

Status: approved

## Overview

Query lab becomes its own page at `/query-lab`, reached from a new "Query lab" link in the main
header, shown only while connected (same pattern `ConnectionBadge` already uses for its own
state). Opening it while not connected sends the user to `/connect` first, the same way
`ClusterOverviewScreen` does today. The page is a two-column layout: a **request pane** on the
left, a **results pane** on the right. The request pane holds one text block written the way
OpenSearch's own console accepts a request — a first line like `GET products/_search`, then the
JSON body underneath, pasted as one piece — plus three toggles (Explain, Validate, Profile)
above it and a Run button. The results pane shows the top 10 hits with a score bar, a
one-step-at-a-time score explanation for the chosen hit, a "why did this miss" box, and a
plain-English restatement of the query with mapping warnings. All of this reuses the score/
explanation reading logic already built (`analysis/explain.ts`) and the four result components
(`HitList`, `ScoreExplainPanel`, `WhyNotMatched`, `QuerySummary`); what changes is how the
request is written, parsed, and sent, and the overall layout and visual styling.

## OpenSearch calls

| Purpose | Method and path | Important parameters |
|---|---|---|
| Run the request, top 10 hits | Method and path from the request line (e.g. `GET /<index>/_search`) | body = pasted body, with `explain` and `profile` overwritten to match the toggles (R2.4, R2.5) and `size` overwritten to 10 |
| Check the query is well formed | `POST /<index>/_validate/query?explain=true&rewrite=true` | body = the pasted body as-is (extra keys such as `explain`/`size` are ignored by this endpoint); only sent when the Validate toggle is on (R2.6) |
| Why one document did or did not match | `POST /<index>/_explain/<doc_id>` | body `{ "query": <the pasted body's "query"> }` (unchanged from the first version) |

Example `_validate/query` response (shortened):

```json
{
  "valid": true,
  "_shards": { "total": 1, "successful": 1, "failed": 0 },
  "explanations": [
    { "index": "products", "valid": true, "explanation": "+title:iphone" }
  ]
}
```

The `_search` and `_explain` examples are unchanged from the first version of this design.

## Cluster code (`src/opensearch/`)

`querylab.ts` changes:

| Function | What it calls | What it returns | Errors |
|---|---|---|---|
| `runQuery(request, method, path, body)` (changed signature — method and path now come from the parsed request line, not assumed) | `request(method, path, body)` | `QueryLabResult` — unchanged shape | `ClusterError`, unchanged |
| `validateQuery(request, index, body)` (new) | `POST /<index>/_validate/query?explain=true&rewrite=true` | `ValidateResult` — `{ valid: boolean; explanations: { index: string; valid: boolean; explanation?: string; error?: string }[] }` | `ClusterError`, unchanged |
| `explainDoc(request, indexName, query, docId)` | unchanged | unchanged | unchanged |

New file `src/analysis/requestBlock.ts` (pure, no cluster calls — parses the left pane's text):

| Function | Purpose |
|---|---|
| `parseRequestBlock(text): ParseResult` | Splits the first line into method + path, checks the path is `<index>/_search` or `<index>/_validate/query`, parses the rest as JSON. Returns `{ ok: true; method; index; path; body }` or `{ ok: false; message }` with a line/column for a JSON mistake, reusing the same position-from-message approach `QueryBox.tsx` already has |
| `withToggles(body, toggles): Json` | Returns a shallow copy of `body` with `explain`, `profile`, and `size: 10` overwritten per the Explain/Profile toggles (R2.5); Validate does not change the body, it only decides whether `validateQuery` is also called |

## Frontend

| Component | What it shows | Data it needs |
|---|---|---|
| `QueryLabPage.tsx` (new, mounted at `/query-lab`) | Redirects to `/connect` if not connected (R1.2); otherwise renders the two-column layout and owns the lifted state (request text, toggle values, run result, selected hit) so navigating away and back keeps it (R1.4) | `useConnection()` |
| `AppHeader.tsx` (changed) | Adds a "Query lab" `NavLink`, rendered only while `state === 'connected' \|\| state === 'lost'` | `useConnection()` |
| `RequestBlock.tsx` (replaces `QueryBox.tsx`) | The one text block (method/path line + JSON body), red state with line/column from `parseRequestBlock`, the three toggles, and the Run button (disabled while loading) | text, toggle values, loading flag |
| `ResultsPane.tsx` (new) | Lays out the error state, the validate result (R2.6), `QuerySummary`, `HitList`, `ScoreExplainPanel`, and `WhyNotMatched`, with the visual polish described below | parsed body's query clause, run result, validate result, index, fields |
| `HitList.tsx`, `ScoreExplainPanel.tsx`, `WhyNotMatched.tsx`, `QuerySummary.tsx` | Unchanged behaviour; `overview.css`'s rules for them are replaced with the restyled versions below | unchanged props |

Visual direction for `ResultsPane` (replacing the first version's plain list/textarea look):

- A card per hit (not a bare button row): id and score in the card header, the stacked score
  bar directly under it, a subtle hover/selected border using the existing `--blue` token.
- The score tree uses indentation plus a left border per depth (like a file tree), not a plain
  nested `<ul>`, so three or four open levels stay readable.
- The plain-words summary and any warnings sit in a highlighted strip directly under the
  request block, so they are seen before the user looks at results.
- Loading state is a skeleton (grey animated bars for 10 hit-card placeholders), not just a
  "Loading…" line, since this page is meant to feel like a real product screen.
- All colours and spacing come from the existing tokens in `styles/theme.css`
  (`--blue`, `--green`, `--red`, `--muted`, `--border`) — no new colour system introduced.

## Fields for warnings (R6.2)

`ResultsPane` needs the chosen index's field types to check for `term` on `text`. Since the page
no longer starts from an opened index (spec 002's `IndexDetail`), it reads the index name parsed
from the request line and calls the existing `getIndexDetail(request, index).fields` itself
(the same function `IndexDetail` already uses) once per run, caching by index name so retyping
the same index does not refetch.

## Errors and empty states

| Situation | What the user sees |
|---|---|
| First line is not `METHOD <index>/_search` or `<index>/_validate/query` | Request block outlined in red; "The first line must be a method and a path ending in _search, like GET products/_search." |
| JSON body is not valid | Same red state; line/column message, same approach as the first version |
| Valid request, OpenSearch refuses it | `clusterErrorReason()` message shown in the results pane, in place of hits (R2.7) |
| Connection lost mid-run | Existing global "Connection lost / Connect again" banner (R2.9), same as the first version — no new code needed |
| Request matches nothing | "No documents matched this query." (R3.2) |
| Explain toggle was off | The hit list still shows ids/scores but no score bar/explain panel (R4.6); a short note explains Explain is off |
| `_explain` target id does not exist | "No document with id '&lt;id&gt;' in this index." (R5.3) |

## Decisions

- The request line's method and path are read with a small hand-written parser
  (`parseRequestBlock`), not a general console grammar, because this spec explicitly only needs
  one request, no comments, and a path ending in `_search` or `_validate/query` (see Out of
  scope) — a full console parser would be solving a bigger problem than asked.
- `validateQuery` is a second, separate call fired alongside `runQuery` when the toggle is on,
  rather than folding validation into the search response, because `_validate/query` and
  `_search` are different OpenSearch endpoints with different answers; showing both side by side
  is clearer than trying to merge them.
- The index's fields (for R6.2's warnings) are fetched by `ResultsPane` itself via the existing
  `getIndexDetail`, rather than requiring the user to have visited Cluster overview first, since
  query lab is now reachable without ever opening an index.
- Explain/Profile are applied by overwriting those keys on the pasted body (`withToggles`)
  rather than rejecting a pasted body that already sets them, so a request copied from a real
  console still runs — the toggles simply win.

## Test plan

- Automatic (fake `request`, Vitest + RTL):
  - `requestBlock.ts`: valid `GET products/_search` + body parses correctly; a bad first line, a
    path not ending in `_search`/`_validate/query`, and broken JSON each produce the right
    message; `withToggles` overwrites `explain`/`profile`/`size` and leaves other keys alone.
  - `querylab.ts`: `runQuery` calls `request` with the method/path from the parsed line;
    `validateQuery` builds the right URL and parses `valid`/`explanations`.
  - `RequestBlock`: red state for a bad first line and for bad JSON; Run calls `onRun` with the
    parsed method/path/body only when valid; toggles default to Explain on, Validate/Profile off.
  - `QueryLabPage`: redirects to `/connect` when not connected; keeps typed text and last result
    when the user navigates to another page and back (simulated via router navigation in the
    test, not a reload).
  - `AppHeader`: "Query lab" link appears only when connected or lost.
  - Existing `HitList`, `ScoreExplainPanel`, `WhyNotMatched`, `QuerySummary`,
    `analysis/explain.ts` tests are kept as-is; `QueryLabScreen`/`IndexDetail`'s query-lab-tab
    tests are removed since that tab no longer exists.
- By hand (practice cluster from `dev/`):
  - Paste `GET products/_search` with a `match` body, run it, open a hit, drill into its score.
  - Turn Validate on and check the rewrite text matches the query.
  - Turn Explain off and confirm the hit list still shows but no score panel appears.
  - Paste a `term` query on a `text` field and confirm the warning appears.
  - Compare the look against the first version and confirm it reads as a finished product
    screen, not a debug page.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `AppHeader.tsx` new "Query lab" link |
| R1.2 | `QueryLabPage.tsx` redirect to `/connect` |
| R1.3 | `QueryLabPage.tsx` initial state |
| R1.4 | State lifted into `QueryLabPage.tsx`, kept while the route is not reloaded |
| R2.1 | `RequestBlock.tsx` text block |
| R2.2 | `RequestBlock.tsx` pretty-print of the JSON part |
| R2.3 | `parseRequestBlock` + `RequestBlock.tsx` red state |
| R2.4 | `RequestBlock.tsx` toggles |
| R2.5 | `withToggles` + `runQuery` |
| R2.6 | `validateQuery` + `ResultsPane.tsx` |
| R2.7 | `clusterErrorReason()` in `ResultsPane.tsx` |
| R2.8 | `RequestBlock.tsx` Run button disabled while loading |
| R2.9 | Existing global connection-lost banner |
| R3.1 | `HitList.tsx` (unchanged) + restyled cards |
| R3.2 | `HitList.tsx` empty state |
| R3.3 | `HitList.tsx` total count line |
| R4.1-R4.5 | `ScoreExplainPanel.tsx` + `analysis/explain.ts` (unchanged) |
| R4.6 | `ResultsPane.tsx` only renders `ScoreExplainPanel` when Explain was on for that run |
| R5.1-R5.3 | `WhyNotMatched.tsx` (unchanged) |
| R6.1-R6.2 | `QuerySummary.tsx` (unchanged), fed fields from `getIndexDetail` |
