# Tasks: mapping lab

Status: approved

Do the tasks in order. One task per `/spec-implement` run.
Tasks 1 to 7 need no cluster. Tasks 8 and 9 wait for spec 001 (see "Needs" on each).

- [x] 1. Browser copy of analysis (R7.3)
  - Files: `frontend/src/analysis/types.ts`, `engine.ts`, `engine.test.ts`
  - Done when: each tokenizer, character filter and token filter of the design has a test;
    "Wi-Fi Router", "Café Crème" and "Sneakers for kids" give the prototype's tokens through the
    "Online shop" chain; an unknown step passes tokens through and adds a note; the answer has the
    raw `_analyze` explain shape

- [x] 2. Read the index definition (R1.2, R1.3, R1.4, R2.1, R2.6, R6.2)
  - Files: `frontend/src/analysis/definition.ts`, `definition.test.ts`
  - Done when: the three shapes are read; JSON mistakes give line, column and a plain message;
    fields include objects and extra fields; the search analyzer order is tested; every check level
    has a test; `createBody` removes `uuid`, `creation_date`, `version`, `provided_name` and flattens
    `settings.index`

- [x] 3. Compare tokens, reasons and the 100 tests (R1.6, R3.1, R3.5, R3.9)
  - Files: `frontend/src/analysis/compare.ts`, `tests.ts`, `compare.test.ts`, `tests.test.ts`
  - Done when: any/all and synonyms at one position are tested; each reason in R3.9 has a test;
    there are 10 lessons of 10 tests; the examples' best fields find 34, 53 and 78 of 100

- [x] 4. Runner and saved lab data (R1.8, R3.11, R4.1, R4.2, R4.3)
  - Files: `frontend/src/screens/MappingLab/runner.ts`, `labStore.ts`, `runner.test.ts`, `labStore.test.ts`
  - Done when: never more than 4 calls are open; the same steps and text are asked once; `cancel()`
    drops late answers; progress counts; the definition and own tests are read back after a new
    store; the 200 limit and the storage-full sentence are tested

- [x] 5. Screen: paste, examples and field cards (R1.1, R1.3, R1.5, R1.6, R1.7, R1.8, R1.9, R2.1 to R2.8, R5.1, R5.5)
  - Files: `frontend/src/screens/MappingLab/MappingLabScreen.tsx`, `ModeBanner.tsx`, `PasteBox.tsx`,
    `ExampleList.tsx`, `FieldCards.tsx`, `ChecksList.tsx`, `useLabResults.ts`, `mappinglab.css`,
    `MappingLabScreen.test.tsx`; route `/mapping-lab` in `App.tsx`; "Mapping lab" link in `AppHeader.tsx`
  - Done when: the screen opens without a cluster with the "Close copy" banner; a broken JSON shows
    line and column and keeps the last result; an example fills the box; cards show steps, tokens,
    the "other steps when searching" note, and problems; the example text updates the cards;
    the page looks like parts 1 and 2 of `prototypes/lab/mapping-lab.html`

- [x] 6. Screen: test 100 searches (R3.2 to R3.12)
  - Files: `frontend/src/screens/MappingLab/TestGrid.tsx`, `MatchChoice.tsx`, `TestSummary.tsx`,
    `TestList.tsx`, `TestDetail.tsx`, `OwnTestForm.tsx`, `TestSection.test.tsx`, `mappinglab.css`
  - Done when: grid cells, column names and lesson names filter the list; Any/All changes the numbers;
    rows show reasons; "Show more" works; an open test shows both sides step by step and the raw
    answer; an own test is added, kept after a new render, and removed; narrow screens use one
    column; the page looks like part 3 of the prototype

- [x] 7. Screen: create the index (R6.1 to R6.8)
  - Files: `frontend/src/screens/MappingLab/CreateIndex.tsx`, `CreateIndex.test.tsx`, `mappinglab.css`
  - Done when: the name changes the text; Dev Tools and curl formats are right; curl has `-u` and
    no password; Copy says what happened (with a fake clipboard); the plain list and the refusal
    warning show; no request is sent; the page looks like part 4 of the prototype

- [ ] 8. Analysis on the cluster (R5.3, R7.1, R7.2)
  - Needs: spec 001 tasks 4 and 5 (guard, client and errors)
  - Files: `frontend/src/opensearch/analyze.ts`, `analyze.test.ts`
  - Done when: with a fake `fetch`, the body is right for custom, built-in and inline steps;
    the guard lets `POST /_analyze` through; a `cluster_error` keeps the cluster's reason;
    a file step gives the R7.2 sentence

- [ ] 9. Exact mode in the screen (R4.1, R4.2, R5.2, R5.3, R5.4)
  - Needs: task 8, and spec 001 task 6 (connection provider)
  - Files: `frontend/src/screens/MappingLab/useLabResults.ts`, `ModeBanner.tsx`, `TestSummary.tsx`,
    `FieldCards.tsx`, `TestGrid.tsx`, `ExactMode.test.tsx`
  - Done when: with a fake connection the banner says "Exact: … Nothing is created."; progress shows
    "n of m" and results appear one by one; a field the cluster refuses shows its reason and the
    others go on; a lost connection stops the run and offers "Use the close copy instead"

- [ ] 10. Manual check against the practice cluster (all)
  - Needs: spec 001 tasks 4 to 9
  - Done when: every acceptance criterion was tried by hand, without and with the practice cluster,
    and the result is written in `notes.md`
