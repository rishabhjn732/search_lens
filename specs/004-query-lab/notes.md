# Notes: query lab

A new session reads this file to continue the work. Newest entry at the bottom.

## Tasks 1-10: cluster calls, score explanation, and the "Search and explain" tab

- Built:
  - `frontend/src/opensearch/querylab.ts`: `runQuery` (`POST /<index>/_search`, explain+profile,
    size 10) and `explainDoc` (`POST /<index>/_explain/<doc_id>`, mapping a 404 to `not_found`).
  - `frontend/src/analysis/explain.ts`: `scoreRows`, `filtersPassed`, `fieldsNotCounted`,
    `plainWordsForQuery`, `queryWarnings` — all pure, no cluster calls.
  - New screen pieces under `frontend/src/screens/ClusterOverview/`: `QueryBox`, `HitList`,
    `ScoreExplainPanel`, `WhyNotMatched`, `QuerySummary`, and `QueryLabScreen` which lays them
    out and wires them to the two cluster functions above.
  - `IndexDetail.tsx` now has a third tab, "Search and explain", and lifts the tab's state
    (`queryLab: QueryLabState` — typed text, last run result, selected hit) so switching tabs
    and back keeps it (R1.3). The state resets only when `indexName` changes, not on
    `refreshToken`.
  - CSS added to `overview.css` (query box, hit bars, score tree, filters list).
  - All 10 implementation tasks' tests pass (`npm test`, 366 tests across the project), and
    `npm run build` (tsc + vite) passes.

- Decisions not already in `design.md`:
  - R2.7 ("connection lost, offer to connect again") needed no new code: `ConnectionProvider`
    already flips global connection state to `lost` on `unreachable`/`timeout`, and the app
    header already shows the "connect again" banner from that state (same pattern used by
    spec 002). `QueryLabScreen` only needs to stop its own loading state when `runQuery` throws;
    it does not duplicate that message.
  - "Why the others did not match" (`WhyNotMatched`) keeps its own `docId`/result state inside
    the component rather than being lifted into `IndexDetail`. `requirements.md` R1.3 only
    promises the query text and the last result survive a tab switch, not the miss-checker's
    typed id, so this was simplified from the design's "missDocId, missResult" wording.
  - `queryFieldNames()` (which fields of the query to pass into `fieldsNotCounted`/
    `ScoreExplainPanel`) is a small helper inside `QueryLabScreen.tsx`, not in `design.md`'s
    function list — it is glue code, not a new behaviour.
  - The "did not count" and "filters passed" logic (`fieldsNotCounted`, `filtersPassed` in
    `analysis/explain.ts`) reads OpenSearch's raw explanation text with regexes
    (`weight(field:value in N)`, `ConstantScoreQuery(clause)`). This matched the design's own
    flagged risk area — it was not checked against a real cluster yet, only against hand-built
    fixtures. Task 11 (manual check) should specifically look at whether real `_explanation`
    text for `best_fields`/`bool` queries actually produces these patterns.

- For the next session (superseded, see below): task 11 was still open when this entry was
  written. It was replaced before being done — see the next entry.

## Spec rewritten: query lab moved to its own top-level page (requirements/design/tasks v2)

The user tried the v1 tab-based query lab and reported two problems: a real bug (pasting a full
`_search` body, including its own `"query"` key, got wrapped in another `"query"` a second
time), and that they wanted a different shape entirely — a console-style request block (like
OpenSearch Dashboards' Dev Tools: `GET products/_search` + the full body) on its own top-level
page, not a tab buried under an opened index, with Explain/Validate/Profile as visible toggles
and a noticeably better visual design. `requirements.md`, `design.md`, and `tasks.md` were all
rewritten for this (see "Changed from the first version" in `requirements.md`) and re-approved.
Tasks 1-10 of the new `tasks.md` are done in this entry; task 11 (manual check) is still open.

- Built:
  - `frontend/src/analysis/requestBlock.ts`: `parseRequestBlock` (reads a `GET products/_search`
    + JSON body block into `{ method, index, path, body }`, reusing the same line/column
    approach the v1 `QueryBox` had for bad JSON) and `withToggles` (overwrites
    `explain`/`profile`/`size` on the pasted body per the toggles, leaving every other key
    alone).
  - `frontend/src/opensearch/querylab.ts`: `runQuery` now takes the method and path explicitly
    (no longer assumes `POST /<index>/_search`); added `validateQuery`
    (`POST /<index>/_validate/query?explain=true&rewrite=true`). `explainDoc` is unchanged.
  - Moved `HitList`, `ScoreExplainPanel`, `WhyNotMatched`, `QuerySummary` (and their tests) from
    `screens/ClusterOverview/` to `screens/QueryLab/` — same relative import depth, so no import
    paths needed to change, just their location.
  - New: `screens/QueryLab/useIndexFields.ts` (fetches+caches one index's fields for the R6.2
    warning, via the existing `getIndexDetail`), `RequestBlock.tsx` (the toggles + request box),
    `ResultsPane.tsx` (lays out validate result, errors, summary, hits, score panel, miss
    checker), `QueryLabPage.tsx` (the page itself, redirects to `/connect` if not connected),
    `querylab.css` (two-column layout, hit cards, indented score tree, warnings strip).
  - `App.tsx` now owns `QueryLabState` above the router (same pattern as `ConnectionProvider`)
    and passes it into the `/query-lab` route, so the typed request and last result survive
    navigating to another page and back (R1.4) — the route element itself unmounts on
    navigation, so the state could not live inside it.
  - `AppHeader.tsx` shows a "Query lab" link only while `state === 'connected' || 'lost'`.
  - `IndexDetail.tsx` is back to just Fields/Settings; `QueryLabScreen.tsx` and `QueryBox.tsx`
    (the v1 files) are deleted, along with their tests and the v1 CSS block in `overview.css`.
  - All 41 test files / 388 tests pass (`npm test`), and `npm run build` (tsc + vite) passes.

- Decisions not already in `design.md`:
  - Found and fixed, while writing `RequestBlock.test.tsx`/`QueryLabPage.test.tsx`, a real bug
    in my own new `useIndexFields` test: passing `vi.fn()` inline inside a `renderHook` callback
    creates a new function reference every render, which made the hook's effect dependency
    change every render and infinite-loop (confirmed by a render-count probe — it crashed the
    Node process with an OOM before that). The hook itself was fine; the test needed the mock
    created once, outside the callback. Worth remembering for any future hook test here: never
    construct `vi.fn()`/objects inline inside a `renderHook`/component callback if they're meant
    to be stable across renders.
  - `ResultsPane` renders `WhyNotMatched` only once an index name is known (`indexName` becomes
    non-null after the first run), since the v2 page has no index until a request has been run,
    unlike v1 where the index was already fixed by the open tab.
  - `validateQuery`'s body is the pasted body as-is (not run through `withToggles`), since
    `_validate/query` ignores `explain`/`profile`/`size` and the design explicitly chose not to
    strip them.

- For the next session:
  - Task 11 (manual check against the practice cluster) is still open. Needs: `dev/` cluster up,
    `products` index seeded, running `GET products/_search` with a `match`/`bool` body from the
    new `/query-lab` page, trying all three toggles (especially Validate's rewrite output and
    Explain off hiding the score panel), a missing doc id and one that fails a filter, a `term`
    query on a `text` field for the warning, and a general look-and-feel check against what the
    user asked for (polished, not a debug page).
  - The `fieldsNotCounted`/`filtersPassed` regex-based reading of OpenSearch's raw explain text
    (flagged as a risk in the v1 design) is unchanged and still unverified against a real
    cluster — same open item as before, just carried over.

## Bug fix: GET with a body is unreachable in a browser

The user hit "Cannot reach the cluster" every time they ran a `GET products/_search` request
with a body (the example from the brief and most OpenSearch docs use `GET`). The cause: a
browser's `fetch` throws synchronously if you give a GET request a body, before any network
call happens; `client.ts`'s catch-all treats that thrown error the same as a real network
failure and reports the cluster as unreachable. Fixed in `runQuery` (`opensearch/querylab.ts`):
a `GET` is now always sent as `POST` instead — OpenSearch answers `_search` and
`_validate/query` identically either way, so nothing about the result changes, only the method
actually put on the wire. `validateQuery` was already hardcoded to `POST` so it was unaffected.

## UI fix: explanation panel detached from the hit card, and a wrong CSS variable

The user reported clicking a hit did nothing visible, and that the page looked "weird" overall.
Two real bugs, not a design problem:

1. `ScoreExplainPanel` was rendered in `ResultsPane` after the entire `HitList`, not inside the
   clicked card — so clicking a hit near the top of a 10-item list gave no visible feedback
   unless you scrolled past every other card. Fixed by moving `ScoreExplainPanel` (and the
   Explain-off note) into `HitList.tsx` itself, rendered inline inside the `<li>` of whichever
   hit is open; clicking the open hit again now collapses it (`onSelect` takes `string | null`).
2. Every border in `querylab.css` used `var(--border)`, which does not exist in
   `styles/theme.css` (the real token is `--line`) — an undefined CSS custom property with no
   fallback makes the property invalid, so every border fell back to the browser default
   (`currentColor`), which is why the page looked harsh/unstyled rather than like the rest of
   the app. Rewrote the whole stylesheet using the real tokens (`--line`, `--panel`, `--board`,
   `--blue`, etc.), added proper styling for `.lbl`/`.status` (scoped under `.query-lab-page`,
   since those two classes were never styled anywhere outside `.mappinglab`), styled the toggle
   checkboxes as pill-shaped chips, gave hit cards shadow/hover states, and made the request
   block sticky so it stays visible while scrolling results.

Updated `HitList.tsx` (new `explainWasOn`/`queryFields` props, `onSelect: (id: string | null)`),
`ResultsPane.tsx` (no longer renders `ScoreExplainPanel` directly), and their tests. All 390
tests pass; `npm run build` passes. This was implementation polish on the already-approved v2
design (which already called for a noticeably better look) — no spec changes.

## UI fix: real score-breakdown cards instead of generic "clause 1" labels

The user shared a reference mock (`explain_diagnostic_tool.tsx`) and asked for the score
explanation to look like that: the real matched field and token, the raw OpenSearch description,
a "score = idf × tf" formula with actual numbers, and a readable idf/tf variable breakdown (N, n,
freq, k1, b, dl, avgdl) — not a flat "clause 1", "clause 2" list.

Found a real bug behind the "clause 1" labels, not just a styling gap: `scoreRows()` always
treated `explanation.details` as the top-level rows whenever they existed. For a `bool` query
wrapped in `"sum of:"`, that's correct (the children are the per-field `weight(...)` nodes). But
for the far more common case — a single `match` clause, no `bool` — the explanation root *is*
the `weight(field:term)` node itself, and its children are idf/tf/boost. The old code unwrapped
into those children and used them as the "top-level rows", so each row's label fell through to
the `clause ${i+1}` fallback (the `weight(...)` regex never matches "idf"/"boost"/"tf" text).
Fixed in `analysis/explain.ts`: `scoreRows` now only unwraps into `.details` when the root's
description is a real combinator (`sum of:`, `max of:`, `product of:`,
`ConstantScoreQuery(...)`); otherwise the root itself becomes the one row.

- Built:
  - `analysis/explain.ts`: added `ExplainRow.metric` ('idf' | 'tf' | 'boost', tagged by
    description prefix), `ExplainRow.description` (the raw text, for display), and two new pure
    helpers — `splitVariable()` (splits "n, number of documents containing term" into symbol +
    description) and `formulaOf()` (pulls the formula out of "idf, computed as ... from:"). All
    covered by new tests in `explain.test.ts`, including a regression test for the bug above.
  - `ScoreExplainPanel.tsx` rewritten: a row whose children include an idf or tf metric renders
    as a `MatchCard` — field/token header, raw description, a score badge, a "score = idf × tf"
    formula strip with real numbers, and side-by-side idf/tf cards each listing their variables
    (symbol chip + description + value). Anything else (a nested bool, a failed clause) still
    falls back to the original one-row-at-a-time collapsible tree, so R4.3's "open one level at
    a time" behaviour is preserved for trees that aren't a plain BM25 leaf. Filter clauses
    (`ConstantScoreQuery`) are no longer shown twice — only in "Filters passed", not as a
    confusing top-level row with no score breakdown.
  - `querylab.css`: new rules for `.match-card`, `.formula-strip`, `.metric-grid`,
    `.metric-card`, `.metric-var-row`, etc.; old `.score-explain > ul` rules renamed/scoped to
    `.generic-fallback` for the fallback tree only.
  - All tests pass, `npm run build` passes. (This is a styling/display change on top of the
    already-approved design — the underlying `_search`/`_explain` calls and data are unchanged.)
