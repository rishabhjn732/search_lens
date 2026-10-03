# Notes: custom word lists

A new session reads this file to continue the work. Newest entry at the bottom.

- 2026-10-03: written from the two prototypes; the user approved all three files by answering a
  question in the session, and Claude changed the `Status:` lines on their instruction.

## Task 1: Rules and checks

- Built: `frontend/src/wordlists/rules.ts` (types, `checkLine`, `parseList`, `parseHunspell`,
  normalising), ported word for word from `prototypes/home/wordlists.js`. 14 tests in `rules.test.ts`.
- Decisions: the sample files are copied to `src/wordlists/fixtures/` and loaded with `?raw`.
  Vite refuses files outside `frontend/` (that also protects `dev/.env`), so the copies are needed.
  If a sample file changes, copy it again.

## Task 2: Store and hook

- Built: `store.ts` (`createStore(storage)`), `samples.ts`, `useWordLists.ts`
  (`useSyncExternalStore` over one shared store). 15 tests in `store.test.ts` with a fake `Storage`,
  one with a size limit for "storage full".
- Decisions: changes run on a `structuredClone`, so a failed save leaves data as it was.
  Files are read with `FileReader`, because jsdom has no `File.text()`.
  `resetWordListStoreForTests()` lets screen tests start from a fresh store.

## Task 3: Word lists page

- Built: `/word-lists` with `WordListsScreen`, `FilesBox`, `EntriesBox`, `EntityTry` (+ `MergePicture`),
  `Message`, `help.tsx`, `wordlists.css`; "Word lists" link in the header. `#entity`, `#protected`,
  `#synonym`, `#hunspell` open a tab. 19 tests in `WordListsScreen.test.tsx` (upload good/bad,
  5 + "more", duplicates, Hunspell pair, Remove with Cancel and with OK and after reload, on/off,
  filter, add/remove entry, last entry, reset, entity join, storage bar, no `fetch`).
- Decisions: only the chosen tab's panel is drawn (the prototype drew all four and hid three).
  Added a screen-reader-only ", " between a file name and its count, because the names ran together
  ("entity.txt8 entities"). The tile icons are coloured squares instead of the prototype's small drawings.

## Task 4: Home page section

- Built: `src/screens/Home/WordListsSection.tsx` (4 upload boxes using the same store, the
  "iPhone sneakers" picture, link to `/word-lists`), styles appended to `home.css`, placed after the
  screen cards in `HomeScreen.tsx`. 5 tests in `WordListsSection.test.tsx`.
- Decisions:
  - The prototype's note said lists "are sent inside each analyze request"; that is not true yet
    (R4.4), so the text now says they stay in this browser.
  - "1 duplicate line skipped" / "1 more problem" use the singular (the prototype always said plural).
- For the next session:
  - All 62 frontend tests pass and the build passes. Everything was tested in jsdom, not yet in a
    real browser: task 5 (manual check) is for the user. Upload the files in
    `prototypes/home/samples/` and compare both screens with the prototypes.
  - Spec 001 R5 says the home page is "without the word lists section"; spec 006 R5 adds it.
