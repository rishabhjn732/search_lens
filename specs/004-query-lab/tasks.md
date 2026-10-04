# Tasks: query lab

Status: approved

Do the tasks in order. Do all task in one but make it beautiful UI.

- [x] 1. Parse the console-style request block (R2.1, R2.3)
  - Files: `frontend/src/analysis/requestBlock.ts`, `frontend/src/analysis/requestBlock.test.ts`
  - Done when: `parseRequestBlock(text)` splits a first line like `GET products/_search` into
    method, index, and path; accepts a path ending in `_search` or `_validate/query`; parses the
    rest as JSON; returns `{ ok: true, method, index, path, body }` for a good block, or
    `{ ok: false, message }` with a line/column for bad JSON, or a plain message for a bad first
    line (wrong method shape, or a path not ending in `_search`/`_validate/query`). Tests pass.

- [x] 2. Apply the Explain/Profile/Validate toggles to a parsed body (R2.4, R2.5)
  - Files: `frontend/src/analysis/requestBlock.ts`, `frontend/src/analysis/requestBlock.test.ts`
  - Done when: `withToggles(body, toggles)` returns a copy of `body` with `explain`, `profile`,
    and `size: 10` overwritten per the Explain/Profile toggle values, leaving every other key in
    `body` (for example `query`, `sort`) unchanged. Tests pass.

- [x] 3. Run a request with the method and path from the parsed line (R2.5, R2.9)
  - Files: `frontend/src/opensearch/querylab.ts`, `frontend/src/opensearch/querylab.test.ts`
  - Done when: `runQuery(request, method, path, body)` sends `request(method, path, body)` and
    returns the same `QueryLabResult` shape as before; a thrown `ClusterError` passes through
    unchanged. Existing `runQuery` tests are updated for the new signature (now takes the method
    and path explicitly rather than assuming `POST /<index>/_search`); `explainDoc` is untouched.

- [x] 4. Validate a query against the cluster (R2.6)
  - Files: `frontend/src/opensearch/querylab.ts`, `frontend/src/opensearch/querylab.test.ts`
  - Done when: `validateQuery(request, index, body)` sends
    `POST /<index>/_validate/query?explain=true&rewrite=true` with `body`, and returns
    `{ valid, explanations }` parsed from a fake response. A thrown `ClusterError` passes through
    unchanged. Tests pass.

- [x] 5. The request block component (R1.3, R2.1, R2.2, R2.3, R2.4, R2.8)
  - Files: `frontend/src/screens/QueryLab/RequestBlock.tsx`,
    `frontend/src/screens/QueryLab/RequestBlock.test.tsx`
  - Done when: starts empty; shows the Explain (on), Validate (off), Profile (off) toggles above
    the block; invalid input (bad first line or bad JSON) shows the red state from
    `parseRequestBlock` and does not call `onRun`; valid input calls `onRun` with the parsed
    result and the toggle values; Run is disabled while `loading` is true. Tests pass.

- [x] 6. Fetch the index's fields for the warning check (R6.2)
  - Files: `frontend/src/screens/QueryLab/useIndexFields.ts`,
    `frontend/src/screens/QueryLab/useIndexFields.test.ts`
  - Done when: a hook/function that, given an index name, calls the existing
    `getIndexDetail(request, index)` and returns its `fields`, caching by index name so asking
    for the same index twice does not call the cluster again. Tested with a fake `request`.

- [x] 7. The results pane: hits, score panel, miss checker, summary (R3.1, R3.2, R3.3, R4.1-R4.6,
      R5.1-R5.3, R6.1, R6.2, R2.6, R2.7)
  - Files: `frontend/src/screens/QueryLab/ResultsPane.tsx`,
    `frontend/src/screens/QueryLab/ResultsPane.test.tsx`
  - Done when: lays out, in order, any `_validate/query` result (R2.6), the cluster error message
    in place of hits (R2.7), `QuerySummary`, `HitList`, and (only when Explain was on for that
    run, R4.6) `ScoreExplainPanel` for the selected hit, and `WhyNotMatched`, reusing the existing
    `HitList`/`ScoreExplainPanel`/`WhyNotMatched`/`QuerySummary`/`analysis/explain.ts` unchanged.
    Tests pass.

- [x] 8. The query lab page and header link (R1.1, R1.2, R1.4)
  - Files: `frontend/src/screens/QueryLab/QueryLabPage.tsx`,
    `frontend/src/screens/QueryLab/QueryLabPage.test.tsx`, `frontend/src/components/AppHeader.tsx`,
    `frontend/src/components/AppHeader.test.tsx` (new or extended), `frontend/src/App.tsx`
  - Done when: `/query-lab` is routed to `QueryLabPage`; not connected redirects to `/connect`;
    "Query lab" appears in the header only while connected or lost; the page lays out
    `RequestBlock` and `ResultsPane` in two columns, owns the lifted state (request text, toggle
    values, run result, selected hit, validate result), and keeps that state across a navigation
    away and back (simulated with the router in the test, not a page reload). Tests pass.

- [x] 9. New visual styling for the query lab page (R3.1 restyled, R4.1-R4.3 restyled)
  - Files: `frontend/src/screens/QueryLab/querylab.css`
  - Done when: the two-column layout, toggle switches, hit cards, indented score tree, warnings
    strip, and loading skeleton described in `design.md` are built using the existing tokens in
    `styles/theme.css`; no visual regression in existing screens (spot-checked by running the
    full test suite and `npm run build`).

- [x] 10. Remove the first version's tab-based query lab (cleanup)
  - Files: `frontend/src/screens/ClusterOverview/IndexDetail.tsx`,
    `frontend/src/screens/ClusterOverview/IndexDetail.test.tsx`,
    `frontend/src/screens/ClusterOverview/QueryLabScreen.tsx` (deleted),
    `frontend/src/screens/ClusterOverview/QueryLabScreen.test.tsx` (deleted),
    `frontend/src/screens/ClusterOverview/QueryBox.tsx` (deleted),
    `frontend/src/screens/ClusterOverview/QueryBox.test.tsx` (deleted)
  - Done when: the "Search and explain" tab and its lifted state are removed from `IndexDetail`
    (back to Fields/Settings only); `HitList.tsx`, `ScoreExplainPanel.tsx`, `WhyNotMatched.tsx`,
    `QuerySummary.tsx` and their tests move to `frontend/src/screens/QueryLab/` since they now
    belong to the new page, with their imports updated; the full test suite and `npm run build`
    pass with no leftover references to the removed tab.

- [ ] 11. Manual check against the practice cluster (all)
  - Done when: every acceptance criterion in `requirements.md` was tried by hand against the
    `products` index from `dev/`, including the Explain/Validate/Profile toggles and the new
    page's look, and the result is written in `notes.md`.
