# Tasks: cluster overview

Status: approved

Do the tasks in order. One task per `/spec-implement` run.

- [x] 1. Index list cluster code (R2.1, R2.2, R2.3, R2.4, R2.5, R7.2)
  - Files: `frontend/src/opensearch/overview.ts`, `frontend/src/opensearch/overview.test.ts`
  - Done when: `listIndexSummaries(request)` reads `_cat/indices`, returns `IndexSummary[]`
    sorted by size descending, flags names starting with `.` as system indexes, and a `forbidden`
    error from the call is left for the caller to handle (not swallowed). Tests use a fake
    `fetch` and cover: normal list, empty list, a mix of system and normal indexes.

- [x] 2. Index detail cluster code: fields and analyzers (R4.1, R4.2, R4.3, R4.5, R7.1)
  - Files: `frontend/src/opensearch/overview.ts`, `frontend/src/opensearch/overview.test.ts`
  - Done when: `getIndexDetail(request, name)` reads `_mapping` and `_settings`, builds
    `Field[]` with `listFields` and a `Chain` per analyzer with `resolveAnalyzer`
    (both from `src/analysis/definition.ts`), and if one of the two calls fails with `forbidden`
    the other call's data still comes back (the failed part is `null` with a `forbidden` flag).
    Tests cover: a normal mapping, a field that cannot be read, one call forbidden while the
    other succeeds.

- [x] 3. Shard layout and "try it" cluster code (R4.4, R5.1, R5.2, R7.1)
  - Files: `frontend/src/opensearch/overview.ts`, `frontend/src/opensearch/overview.test.ts`
  - Done when: `getShardLayout(request, name)` reads `_cat/shards` filtered to `name` and marks
    `UNASSIGNED` rows `assigned: false`; `tryAnalyzer(request, name, field, text)` posts to
    `_analyze` with `{field, text}` and returns `Token[]`. Tests cover: shards across two nodes
    with one unassigned, and a successful `tryAnalyzer` call.

- [x] 4. Index chart and search box (R2.1, R2.2, R2.3, R2.4, R2.5, R3.1, R3.2, R3.3, R3.4, R7.2, R8.1)
  - Files: `frontend/src/screens/ClusterOverview/ClusterOverviewScreen.tsx`,
    `frontend/src/screens/ClusterOverview/IndexChart.tsx`,
    `frontend/src/screens/ClusterOverview/IndexSearch.tsx`,
    `frontend/src/screens/ClusterOverview/*.test.tsx`, `frontend/src/App.tsx` (add `/overview` route)
  - Done when: the screen loads `listIndexSummaries` once, draws the top-10 chart with a size/
    documents sort toggle, shows system and extra-index counts, shows the empty-cluster message,
    shows the whole-screen forbidden message, and the search box filters all names and shows the
    no-match message. Choosing a chart bar or a search result calls an `onOpenIndex(name)` prop
    (wired up fully in task 5). Tests use a fake `fetch`.

- [x] 5. Index detail panel: Fields tab (R4.1, R4.2, R4.3, R4.4, R4.5, R7.1, R8.1)
  - Files: `frontend/src/screens/ClusterOverview/IndexDetail.tsx`,
    `frontend/src/screens/ClusterOverview/FieldTree.tsx`,
    `frontend/src/screens/ClusterOverview/TryItBox.tsx`, matching `*.test.tsx`
  - Done when: choosing an index in task 4's screen opens `IndexDetail`, its Fields tab shows the
    tree with one plain sentence and analyzer pills per field, a "try it" box per analyzed field
    that calls `tryAnalyzer` and shows the resulting tokens, a per-row message for a field that
    could not be read, and a tab-level message when the whole mapping call was forbidden.

- [x] 6. Index detail panel: Settings tab (R5.1, R5.2, R5.3, R7.1, R8.1)
  - Files: `frontend/src/screens/ClusterOverview/ShardMap.tsx`, matching `*.test.tsx`
  - Done when: the Settings tab shows the shard/replica picture by node with unassigned shards in
    red, the plain-word settings (shard count, replica count, refresh interval) next to it, and
    the same forbidden/loading states as the Fields tab.

- [x] 7. Refresh and reload rules (R6.1, R6.2, R6.3, R6.4)
  - Files: `frontend/src/screens/ClusterOverview/ClusterOverviewScreen.tsx`,
    `frontend/src/screens/ClusterOverview/ClusterOverviewScreen.test.tsx`
  - Done when: the screen loads once on mount, shows a Refresh button, Refresh reloads the index
    list and, if an index is open, that index's detail too, and no code path reloads data on a
    timer or interval.

- [x] 8. Go to the overview after connecting (R1.1, R1.2, R8.2)
  - Files: `frontend/src/screens/Connect/ConnectScreen.tsx`,
    `frontend/src/screens/Connect/ConnectScreen.test.tsx`,
    `frontend/src/screens/Home/ScreenCards.tsx`, `frontend/src/App.tsx`
  - Done when: a successful `connect()` navigates to `/overview`; the home page's Cluster
    overview card becomes a real link instead of "Coming soon"; `/overview` redirects to
    `/connect` when not connected; a lost connection on the overview screen shows the same
    lost-connection banner and reconnect offer as spec 001 R4.3.

- [ ] 9. A field's analyzer playground (R4.2, R4.4, R9.1, R9.2, R9.3, R9.4, R9.5, R9.6, R9.7)
  - Files: `frontend/src/screens/ClusterOverview/FieldPlayground.tsx`,
    `frontend/src/screens/ClusterOverview/FieldPlayground.test.tsx`,
    `frontend/src/screens/ClusterOverview/FieldTree.tsx` (+ test, "Try it" opens the playground
    instead of the inline box; field sentence uses the full path),
    `frontend/src/screens/ClusterOverview/IndexDetail.tsx` (+ test, holds which field's
    playground is open), `frontend/src/opensearch/overview.ts` (+ test, remove `tryAnalyzer` —
    superseded by R9, no longer called from anywhere)
  - Also delete: `frontend/src/screens/ClusterOverview/TryItBox.tsx` and its test (replaced by
    `FieldPlayground`).
  - Done when: choosing "Try it" on an analyzed field opens a full view showing that field's
    analyzer steps (reusing `Steps`/`Chips` from `src/screens/MappingLab/Pieces.tsx`) and, once
    text is typed, the tokens after each step (`analyzeInBrowser` from `src/analysis/engine.ts`);
    a token filter can be moved one position earlier or later, which re-runs
    `analyzeInBrowser` on the edited chain with no cluster call; a Reset control restores the
    cluster's real order; a fixed sentence says this runs in the browser and changes nothing on
    the cluster; closing the view returns to the Fields tab exactly as it was. `FieldTree` rows
    now show the field's full dotted path, not just its last segment.

- [ ] 10. Manual check against the practice cluster (all)
  - Done when: every acceptance criterion in `requirements.md` was tried by hand against the
    `dev/` practice cluster and the result is written in `notes.md`.
