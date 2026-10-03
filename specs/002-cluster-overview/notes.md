# Notes: cluster overview

A new session reads this file to continue the work. Newest entry at the bottom.

## Task 1: Index list cluster code

- Built: `frontend/src/opensearch/overview.ts` with `listIndexSummaries(request)`. It calls
  `GET /_cat/indices?format=json&bytes=b&h=index,health,status,docs.count,store.size`, returns
  `IndexSummary[]` (`name`, `health`, `docsCount`, `sizeBytes`, `isSystem`) sorted by size,
  descending. Dotted names (`.kibana_1`) get `isSystem: true`. A `forbidden` (or any) error from
  `request` is not caught here — it passes straight to the caller, as the design asked, so the
  screen (task 4) decides how to show it.
- Decisions: none beyond the design.
- For the next session: task 2 adds `getIndexDetail` to the same file, reusing `listFields` and
  `resolveAnalyzer` from `src/analysis/definition.ts` (spec 007). Check that module's `Json` type
  before writing the new function — the real `_mapping`/`_settings` responses must match the
  shape `listFields`/`resolveAnalyzer` expect.

## Task 2: Index detail cluster code: fields and analyzers

- Built: `getIndexDetail(request, name)` in `frontend/src/opensearch/overview.ts`. It calls
  `GET /<index>/_mapping` and `GET /<index>/_settings` with `Promise.allSettled`, so one being
  forbidden does not stop the other (R7.1). It unwraps the real response shape
  (`{ "<index>": { mappings: {...} } }` and `{ "<index>": { settings: { index: { analysis } } } }`)
  down to the plain `mappings`/`analysis` objects `listFields`/`resolveAnalyzer` expect (those two
  functions are unchanged from spec 007). Returns `{ fields, fieldsError, analyzers }`:
  `fields` is `null` only when the mapping call itself failed; `analyzers` is a map from analyzer
  name to resolved `Chain`, built only for analyzers that resolve without an error.
- Decisions: if the mapping call succeeds but the settings call fails, fields still come back
  (with sensible analyzer-name defaults from `listFields`'s own fallback logic), but
  `resolveAnalyzer` naturally finds no definition for a non-built-in analyzer name and that name
  is left out of `analyzers` — the design's "forbidden on settings, mapping still shown" case is
  covered by this instead of a separate error flag, since `resolveAnalyzer` already degrades
  gracefully. The design's "a field cannot be read" row-level message (R4.5) could not be
  triggered from `listFields` itself (it never throws — malformed field data just falls back to
  a plain `object`/`other` field), so that message will have to come from task 5's `FieldTree`
  reacting to something else (e.g. a field with no recognizable type) rather than from this
  function. Flagging this now so task 5 doesn't assume `overview.ts` marks bad fields itself.
- For the next session: task 3 adds `getShardLayout` and `tryAnalyzer` to the same file. No shard
  or settings (shard count/replica count/refresh interval) reading exists yet — task 3 needs to
  read `number_of_shards`/`number_of_replicas`/`refresh_interval` itself from the same
  `_settings` shape this task already unwraps (see `obj(obj(settingsResult.value)[name]).settings`
  in `getIndexDetail`), since the design's R5.3 plain-word settings weren't added here (task 2's
  "done when" only required fields and analyzers).

## Task 3: Shard layout and "try it" cluster code

- Built: `getShardLayout(request, name)` and `tryAnalyzer(request, name, field, text)` in
  `frontend/src/opensearch/overview.ts`. `getShardLayout` reads `_cat/shards` (all indexes),
  keeps only rows for `name`, and groups them by node; a row with `state: "UNASSIGNED"` gets
  `assigned: false` and its `node` is `null`. `tryAnalyzer` posts `{field, text}` to
  `/<index>/_analyze` and returns the `tokens` array, reusing the `Token` shape from
  `src/analysis/types.ts` so the result can go straight into existing token-drawing code.
- Decisions: `_cat/shards` is not filtered server-side (no `index` query parameter in the
  reference doc for that path) — filtering happens in the browser after the one call, same as
  the design expected.
- For the next session: cluster code for spec 002 is done (`overview.ts` now has
  `listIndexSummaries`, `getIndexDetail`, `getShardLayout`, `tryAnalyzer`). Task 4 starts the UI:
  `ClusterOverviewScreen`, `IndexChart`, `IndexSearch`, and the `/overview` route in `App.tsx`.
  Remember task 2's flag: the "field could not be read" row message (R4.5) needs its own
  decision in `FieldTree` (task 5), since no function here marks a field as unreadable.

## Task 4: Index chart and search box

- Built: `frontend/src/screens/ClusterOverview/` with `ClusterOverviewScreen.tsx`,
  `IndexChart.tsx`, `IndexSearch.tsx`, `overview.css`, and their tests; added the `/overview`
  route to `App.tsx`. The screen loads `listIndexSummaries` once on mount, shows a Refresh
  button that reloads it, and has no timer anywhere (R6.1, R6.2, R6.4). `IndexChart` shows the
  top 10 non-system indexes as bars with a size/documents sort toggle, health word and dot, plus
  counts for system indexes and indexes beyond the top 10 (R2.1-R2.4). `IndexSearch` filters all
  names (including system ones) as the user types, with a no-match message (R3.1-R3.4). Choosing
  a bar or a search result calls `onOpenIndex`, which the screen stores as `openIndexName` state
  and shows as plain text for now — task 5 replaces that with the real `IndexDetail` panel.
- Decisions: the whole-screen forbidden message uses the spec 002 wording ("This user cannot
  read the list of indexes.") rather than the generic `forbiddenError()` message from
  `errors.ts`, because R7.2 asks for that specific sentence; this is a UI-level text choice, not
  a new error code.
- For the next session: task 5 builds `IndexDetail`, `FieldTree`, `TryItBox` and wires
  `openIndexName` in `ClusterOverviewScreen` to actually render them (calling `getIndexDetail`
  and `tryAnalyzer` from `overview.ts`). Also resolve task 2's open flag about R4.5's per-field
  error row there.

## Task 5: Index detail panel: Fields tab

- Built: `IndexDetail.tsx` (tab switcher, loads `getIndexDetail` when `indexName` changes,
  cancels a stale load if the index changes again before it resolves), `FieldTree.tsx` (one row
  per field: a plain sentence, pills for a text field's analyzer steps, a `TryItBox` for text
  fields), `TryItBox.tsx` (text input, Try it button, calls `tryAnalyzer` through the cluster,
  shows tokens or an error). `ClusterOverviewScreen` now renders `IndexDetail` for the chosen
  index instead of the plain-text placeholder from task 4.
- Decisions:
  - Resolved task 2's open flag: R4.5 ("a field cannot be read") is detected in `FieldTree` as
    `kind === 'other' && type === 'object'` — the exact shape `listFields` produces for a field
    whose raw mapping entry had neither a usable `type` nor `properties` (confirmed by task 2's
    own "field that is not a usable object" test). No new error-marking code was needed in
    `overview.ts`.
  - Exported `plainStep` from `src/analysis/compare.ts` (was a private helper) instead of
    writing a second step-label function, to build the R4.3 pills from the same word list spec
    007 already uses for its own sentences.
  - Tree indentation (R4.1) is computed from the number of dots in `field.path`, not from
    `field.parent` — `listFields` only sets `parent` for multi-fields (e.g. `title.keyword`), not
    for children of a nested/object field, so path depth is the only signal that works for both.
  - The Settings tab exists as a button and switches `tab` state, but shows only a placeholder
    sentence for now — task 6 fills it with `ShardMap`.
- For the next session: task 6 adds `ShardMap.tsx` and wires it into `IndexDetail`'s Settings
  tab, using `getShardLayout` from `overview.ts` (already built in task 3) and the plain-word
  settings (shard/replica count, refresh interval) which still need to be read from the
  `_settings` response — `getIndexDetail` does not return them yet, so task 6 should add that
  itself, reusing the same unwrapping pattern as `getIndexDetail`'s `settingsResult` handling.

## Task 6: Index detail panel: Settings tab

- Built: `getIndexDetail` in `overview.ts` now also returns `settings: IndexSettings | null`
  (shards, replicas, refreshInterval) and `settingsError: ClusterError | null`, read from the
  same `_settings` response it already unwraps for `analysis` — no extra cluster call needed.
  `ShardMap.tsx` draws the shard/replica boxes grouped by node (from `getShardLayout`, task 3)
  with unassigned copies styled red, next to the plain-word settings. `IndexDetail`'s Settings
  tab now calls `getShardLayout` the first time it is opened (not on mount, matching the
  design's "lazy" decision) and shows the same forbidden/loading states as the Fields tab.
- Decisions: tracked "has the shard fetch started" with a `useRef`, not a second piece of
  state. An earlier version used `shardLoad !== null` as the effect's own guard condition while
  also listing `shardLoad` in the effect's dependency array — React re-ran the effect the instant
  `setShardLoad({status:'loading'})` landed, which fired the *previous* run's cleanup
  (`cancelled = true`) and silently dropped the real fetch's result, stuck on "Loading shards…"
  forever. Caught by the task's own test clicking the Settings tab and waiting for the shard
  boxes to appear. Lesson: a status-shaped state value is the wrong thing to also use as an
  effect's own re-run guard; a ref (not reactive, doesn't retrigger the effect) is the right tool
  for "did this already start".
- For the next session: cluster-overview UI pieces (chart, search, Fields tab, Settings tab) are
  all built. Remaining: task 7 (Refresh must also reload the open index's detail, not just the
  index list — right now Refresh in `ClusterOverviewScreen` only reloads the list), task 8
  (navigate to `/overview` after connecting, and redirect `/overview` to `/connect` when not
  connected — right now opening `/overview` while disconnected just shows a "Not connected to a
  cluster." error from `useConnection().request`, which is not wrong but not what R1.2 asks for),
  and task 9 (manual check against `dev/`).

## Task 7: Refresh and reload rules

- Built: `ClusterOverviewScreen` now keeps a `refreshToken` counter, bumped once inside `reload()`
  alongside the index-list reload. It is passed to `IndexDetail` as a new optional prop
  (`refreshToken`, defaults to 0). `IndexDetail`'s field/analyzer load effect and its
  shard-fetch-started ref both now also depend on `refreshToken`, so Refresh re-fetches the open
  index's mapping/settings and, if the Settings tab is the one open, its shard layout too (R6.3).
  Nothing in the screen or `IndexDetail` uses a timer or interval anywhere (R6.4, unchanged from
  task 4 and 6, re-confirmed by this task's own "waits without clicking, call count doesn't grow"
  test).
- Decisions: none beyond the design; this task was mostly wiring a prop through, since tasks 4-6
  already had the loading/empty/forbidden states and the single Refresh button in place.
- For the next session: task 8 is the last functional piece — making a successful `connect()`
  navigate to `/overview` (R1.1), making the home page's Cluster overview card a real link
  (R1.2), and redirecting `/overview` to `/connect` when not connected. Then task 9 is the manual
  check against the `dev/` practice cluster, which also doubles as the first real end-to-end look
  at this whole spec (nothing in tasks 1-7 has been tried against an actual OpenSearch yet, only
  fake `fetch`).

## Task 8: Go to the overview after connecting

- Built: `ConnectScreen` now calls `navigate('/overview')` right after `connect()` resolves
  (R1.1). `ClusterOverviewScreen` returns `<Navigate to="/connect" replace />` when
  `state === 'not_connected' || 'connecting'` (R1.2's "while already connected" case already
  worked for free once the home card below became a real link). The home page's Cluster overview
  card (`ScreenCards.tsx`) is now `ready: true`, so it is a real `<Link>` instead of a
  "Coming soon" block. R8.2 (lost connection shows the reconnect banner) needed no new code: the
  header's `ConnectionBadge` already shows "Connection lost" / "Connect again" on every screen,
  including this one, when `state === 'lost'` — so `ClusterOverviewScreen`'s own redirect check
  deliberately does NOT treat `'lost'` the same as `'not_connected'` (it would otherwise bounce
  a lost connection straight to `/connect` and hide that banner).
- Decisions: the connect-success block in `ConnectScreen` (cluster name/version/node count,
  spec 001 R1.1) is now practically unreachable in normal use, since `navigate('/overview')`
  fires in the same tick as the `connected` state update and React batches them — the user never
  sees it render. Left it in place rather than deleting it: it is still correct if `navigate`
  ever fails silently, and removing display code that satisfies an *approved, different* spec's
  requirement (001 R1.1) felt like a decision for the user, not something to do quietly while
  implementing spec 002. Flagging this out loud rather than deciding alone.
  Also updated two tests outside this spec's own files, both as the *expected* consequence of
  this task rather than weakening anything: `ConnectScreen.test.tsx`'s R1.1 test now checks for
  navigation to the overview page instead of checking facts text that no longer has time to
  render, and `HomeScreen.test.tsx`'s R5.3 test now expects 2 links (Connect, Cluster overview)
  and 3 "Coming soon" cards instead of 1 and 4 — both tests were asserting the exact "not built
  yet" state that this task intentionally changes.
- For the next session: task 9 is the only one left — the manual check against the `dev/`
  practice cluster, confirming all of requirements.md by hand and writing the result into this
  file.
