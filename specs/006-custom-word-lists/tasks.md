# Tasks: custom word lists

Status: approved

Do the tasks in order. One task per `/spec-implement` run.

- [x] 1. Rules and checks (R1.2, R1.3, R1.4, R1.7)
  - Files: `frontend/src/wordlists/rules.ts`, `rules.test.ts`
  - Done when: every row of the design's messages table that `rules.ts` owns is tested, and the
    sample files give the expected results

- [x] 2. Store and hook (R1.1, R1.5, R1.6, R2.3, R2.4, R2.6, R2.7, R2.9, R4.1, R4.2, R4.3, R4.4)
  - Files: `frontend/src/wordlists/store.ts`, `samples.ts`, `useWordLists.ts`, `store.test.ts`
  - Done when: the store tests in the test plan pass, including storage full and reload

- [x] 3. Word lists page (R2.1 to R2.9, R3.1 to R3.3, R4.2)
  - Files: `frontend/src/screens/WordLists/WordListsScreen.tsx`, `FilesBox.tsx`, `EntriesBox.tsx`,
    `EntityTry.tsx`, `wordlists.css`, `WordListsScreen.test.tsx`; route `/word-lists` in `App.tsx`;
    "Word lists" link in `AppHeader.tsx`
  - Done when: the page tests pass and the page looks like `prototypes/home/a-word-lists.html`

- [x] 4. Home page section (R5.1 to R5.3)
  - Files: `frontend/src/screens/Home/WordListsSection.tsx`, `WordListsSection.test.tsx`, `home.css`,
    `HomeScreen.tsx`
  - Done when: the home section tests pass and the home page looks like
    `prototypes/home/a-clean-lab.html` including the word lists section

- [ ] 5. Manual check (all)
  - Done when: every criterion was tried by hand in a browser and the result is in `notes.md`
