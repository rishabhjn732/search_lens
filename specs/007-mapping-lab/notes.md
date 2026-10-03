# Notes: mapping lab

A new session reads this file to continue the work. Newest entry at the bottom.

## Requirements (2026-10-03)

- Written from `prototypes/lab/mapping-lab.html`, which the user approved as the look.
- User answers: both modes (browser copy without a cluster, exact `_analyze` when connected);
  own tests and the last pasted definition are kept in browser storage; word lists (006) are
  not used in this spec.
- The browser copy of analysis (`prototypes/lab/analyzer.js`) and the 100 tests
  (`prototypes/lab/samples.js`) are the starting point for the design.
- Exact mode needs spec 001 tasks 4 to 8 (guard, client, connection). The close-copy mode does not.
- Requirements approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.
- Open questions answered (user said yes to all proposals); written into requirements.md "Open questions".

## Design (2026-10-03)

- design.md written as draft. Browser-only mode comes first; cluster mode needs spec 001 tasks 4 to 8.
- New folder `src/analysis/` (port of the prototype engine), shared later with spec 003.
- Design approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.

## Tasks (2026-10-03)

- tasks.md written as draft: 10 tasks. 1 to 7 need no cluster; 8 and 9 wait for spec 001 tasks 4 to 6.
- Tasks approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.

## Task 1: Browser copy of analysis

- Built: `frontend/src/analysis/types.ts` (AnalyzeResponse = raw `_analyze` explain shape, Chain, Step,
  Field), `engine.ts` (`analyzeInBrowser`, `finalTokens`, `notesFor`, `describeStep`, `isKnown`,
  `fold`, `stem`, `STOP_EN`), `engine.test.ts` (22 tests). All 84 frontend tests pass.
- Decisions: notes for unknown steps come from `notesFor(chain)`, not inside the response, so the
  response keeps the exact cluster shape and the runner can treat both sources the same.
  A `Step` has `known`; the engine still checks the type itself, so a wrong flag cannot break it.
- For the next session: task 2 builds chains from the pasted JSON (`definition.ts`), including
  built-in analyzers as their parts (`english` = standard, stemmer/possessive_english, lowercase,
  stop/_english_, stemmer/english) and setting `known` with `isKnown`. Port from
  `prototypes/lab/analyzer.js` (`builtinAnalyzer`, `resolveAnalyzer`, `readIndexJson`, `jsonErrorAt`,
  `listFields`, `chainFor`, `checkIndex`).

## Task 2: Read the index definition

- Built: `frontend/src/analysis/definition.ts` (`readDefinition`, `listFields`, `resolveAnalyzer`,
  `resolveNormalizer`, `chainFor`, `checkDefinition`, `createBody`, `NO_PROPERTIES`, `KEYWORD_CHAIN`)
  and `definition.test.ts` (18 tests). All 102 frontend tests pass.
- Decisions: a list of OpenSearch's built-in tokenizer, char filter and token filter names is in
  `definition.ts`. It tells a problem ("not defined and not built in": OpenSearch refuses) from a
  warning ("built in, but this page does not copy it", for example `cjk_width`). R2.6 needs both.
  `{properties}` alone is not accepted (R1.2 lists three shapes); it gets the R1.4 message.
  `createBody` removes only the four settings R6.2 names.
- For the next session: task 3 is `compare.ts` (`compareTokens`, `reasonFor`, `plainChain`) and
  `tests.ts` (100 tests and 3 examples from `prototypes/lab/samples.js`). The example numbers to
  check: defaults 34, english 53, shop 78 (best field, "any word").

## Task 3: Compare tokens, reasons and the 100 tests

- Built: `frontend/src/analysis/compare.ts` (`compareTokens`, `reasonFor`, `NOTHING_LEFT`, `plainChain`,
  `countFound`), `tests.ts` (10 lessons, 3 examples), `compare.test.ts`, `tests.test.ts`.
  All 128 frontend tests pass; `tsc` is clean.
- Decisions: `tests.ts` was generated from `prototypes/lab/samples.js` by a one-off script, so no
  test text was retyped by hand. `countFound(def, path, mode, cases)` is not in the design's file
  table; it was added to `compare.ts` because task 5 needs it for "best field finds n of 100" (R1.6)
  and task 6 for "finds n of m" (R3.6). Checked numbers (any word, browser copy): defaults 34,
  english (`title_folded`) 53, shop (`title`) 78, same as the prototype.
- For the next session: "found" means every typed word was found, in both modes. "Any word" vs
  "All words" only changes "partly found" into "not found" (tested). The grid cell "n/10" in task 6
  should count "found". `reasonFor` takes one missing token; the screen picks the first missing one.
  Task 4 is `runner.ts` and `labStore.ts` in `src/screens/MappingLab/`.

## Task 4: Runner and saved lab data

- Built: `frontend/src/screens/MappingLab/runner.ts` (`createRunner(source, {parallel: 4})` with
  `get`, `lookup`, `progress`, `subscribe`, `cancel`; `analysisKey`, `CancelledError`, `isCancelled`),
  `labStore.ts` (`createLabStore(storage)`: definition text and own tests, 200 limit, storage-full
  sentence), `runner.test.ts` (11 tests), `labStore.test.ts` (12 tests). 151 frontend tests pass.
- Decisions: the cache key uses the type and settings of each step, not the step names, so `title`
  and `description` share answers (design). Failures are kept per analysis (`lookup` gives
  `{status: 'error'}`), so one bad field does not stop the others (R5.3); a new runner is made when
  the definition or the mode changes. `get()` promises of a cancelled run reject with
  `CancelledError`; an error promise nobody awaits is marked handled so it is not reported.
  The storage-full sentence is the word-lists sentence word for word, including "Remove a list and
  try again." (user answer: same message). It reuses `formatSize` and `QUOTA` from `wordlists/store.ts`
  without changing that file. Saving an empty definition (Clear) is remembered; `definitionText()` is
  `null` only when nothing was ever saved (then the screen shows "Online shop", R1.8).
- For the next session: task 5 needs a `useLabStore` hook (like `useWordLists`) and a browser
  source: `async (chain, text) => analyzeInBrowser(chain, text)`.

## Task 5: Screen: paste, examples and field cards

- Built (all in `frontend/src/screens/MappingLab/`): `MappingLabScreen.tsx`, `PasteBox.tsx`,
  `ExampleList.tsx`, `FieldCards.tsx`, `ChecksList.tsx`, `ModeBanner.tsx`, `Pieces.tsx` (step labels
  and token chips, shared with task 6), `useLabResults.ts`, `useLabStore.ts`, `mappinglab.css`,
  `MappingLabScreen.test.tsx` (24 tests). Route `/mapping-lab` in `App.tsx`, "Mapping lab" link in
  `AppHeader.tsx`. Also `bestFieldFinds` added to `src/analysis/compare.ts` (with a test).
  176 frontend tests pass, `tsc` and `npm run build` are clean. Checked by eye in headless Chrome:
  the page looks like parts 1 and 2 of `prototypes/lab/mapping-lab.html`; numbers match
  (title 78, title.suggest 52, description 43, brand 4).
- Decisions: the runner is created inside an effect, not while drawing, because `main.tsx` uses
  `StrictMode` (effects run twice in development); there is a test for it. The text is read 350 ms
  after typing stops, and at once for Tidy, Clear and the examples. The pasted text is saved each
  time it is read, even when it is broken (R1.8 "last pasted"). A broken text keeps the last good
  result on screen; an empty box shows none (R1.3, design). The status counts (fields, analyzers,
  problems) are made in `read()` in the screen. `ModeBanner` only shows "Close copy" for now.
  The stepper has links 1 and 2; tasks 6 and 7 add 3 and 4. "Test this field" marks the card
  (`aria-current`) and scrolls to `#test` when it exists; task 6 adds that section.
- For the next session: task 6 needs `cases` to include own tests (`useLabResults(definition,
  example, cases)` takes the list; the screen passes `TESTS`, a constant, so a new list must be
  memoized). `results.tokens(path, side, text)` and `results.found(path)` are ready for the grid.

## Task 6: Screen: test 100 searches

- Built (all in `frontend/src/screens/MappingLab/`): `TestSection.tsx` (holds mode, result filter,
  "show more" and open tests), `MatchChoice.tsx`, `TestGrid.tsx`, `TestSummary.tsx`, `TestList.tsx`,
  `TestDetail.tsx`, `OwnTestForm.tsx`, `cases.ts` (built-in plus own tests as the lesson "My tests"),
  `stages.ts` (an open test step by step), `TestSection.test.tsx` (18 tests). Changed: `MappingLabScreen.tsx`
  (focus state, own tests, stepper link 3), `useLabResults.ts` (`test()`, `testableFields`,
  `currentField`; answers kept with tokens), `Pieces.tsx` (`Chips` with green/red marks),
  `mappinglab.css`. 195 frontend tests pass; `tsc` and `npm run build` are clean. Checked by eye in
  headless Chrome (grid, shading, summary bar, rows, red chip and reason).
- Decisions: `compareTokens` now also returns `unfound` (the typed words that were not found), so a
  reason is about the right word and not the first missing token (test added in task 3's file).
  `analysisKey` builds the steps part once per chain (WeakMap) because the grid asks 1,000+ times.
  `labStore` returns one shared "nothing saved" value so `ownTests()` keeps the same identity.
  The list of tests is a `<ul>`, not `<article>`s, so field cards stay the only articles.
  Progress ("Running the tests: n of m") shows from the start (one extra render after asking).
  The grid cell counts "found", which is the same in both modes; Any/All only changes partly vs not
  found in the summary, the list and the filters.
- For the next session: task 7 (create the index) is part 4 of the page; add stepper link 4 and a
  `#create` section after `TestSection`. `createBody`, `checkDefinition` and `plainChain` are ready.
  Exact mode (tasks 8 and 9) will replace the browser source in `useLabResults.ts` and extend
  `ModeBanner`; `results.progress` and `test()` already work the same for any source.

## Task 7: Screen: create the index

- Built (in `frontend/src/screens/MappingLab/`): `createRequest.ts` (`indexName`, `requestText`,
  `plainSummary`), `CreateIndex.tsx`, `CreateIndex.test.tsx` (13 tests); `MappingLabScreen.tsx` shows it
  and has stepper link 4; `mappinglab.css`. 208 frontend tests pass (three runs in a row), `tsc` and
  `npm run build` are clean. Checked by eye in headless Chrome.
- Decisions: the curl text uses the placeholder address `https://localhost:9200` and `-u admin` (no
  password; curl asks), with a hint to change both. The name from a pasted `GET /<index>` answer is
  the default until the user types another; a new pasted name replaces a typed one. A name with
  marks OpenSearch refuses is cleaned while shown (`Shop V2!` becomes `shop-v2-`), and an empty name
  becomes `my-index`. Analyzer sentences in the plain list keep capitals for acronyms ("HTML removed…");
  a first version wrote "hTML", found while checking a too loose test. `TestSection.test.tsx` has a
  20 s time limit because the first test runs about 1,000 analyses and took 2.5 to 3.7 s here.
- For the next session: tasks 1 to 7 are done, so the Mapping lab works in the browser without a
  cluster ("Close copy"). Tasks 8 to 10 need spec 001: task 8 needs 001 tasks 4 and 5 (read-only
  guard, cluster client and errors); task 9 needs 001 task 6 (connection provider); task 10 needs
  001 tasks 4 to 9 and a person with a browser. Do not build those 001 tasks inside spec 007
  (one feature per branch). Run `/spec-implement 001` first, then `/spec-implement 007 8`.
