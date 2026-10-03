# Tasks: connect to a cluster

Status: approved

Do the tasks in order. One task per `/spec-implement` run.

The plan changed to browser-only on 2026-10-03. The old task 1 (backend skeleton) was built and is
removed again by task 2. History is in `notes.md`.

- [x] 1. Frontend skeleton (setup)
  - Files: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/App.tsx`
  - Done when: the app shows an empty page with a header, and `npm test` passes

- [x] 2. Remove the backend (setup)
  - Files: delete `backend/`, `.claude/rules/backend.md`, `frontend/src/api/`; remove the `/api`
    proxy from `frontend/vite.config.ts`; update the backend mentions in `README.md`,
    `docs/learning/01-claude-code-files.md`, `docs/learning/04-exercises.md`,
    `.claude/agents/code-reviewer.md`, `.claude/skills/spec-design/SKILL.md`, `.claude/skills/spec-tasks/SKILL.md`
  - Done when: no file outside `specs/` and `notes.md` refers to a backend, and `npm test` and
    `npm run build` pass

- [x] 3. Home page (R5.1 to R5.8)
  - Files: `frontend/src/styles/theme.css`, `frontend/src/components/AppHeader.tsx`,
    `frontend/src/screens/Home/HomeScreen.tsx`, `QueryDemo.tsx`, `ScreenCards.tsx`, `HowItWorks.tsx`,
    `demoData.ts`, `HomeScreen.test.tsx`; router set up in `frontend/src/App.tsx`
    (`/connect` shows a placeholder until task 7)
  - Done when: the tests in the design's "Home page" test list pass, and the page looks like
    `prototypes/home/a-clean-lab.html` without the word lists section

- [x] 4. Read-only guard (R3.1, R3.2)
  - Files: `frontend/src/opensearch/guard.ts`, `guard.test.ts`
  - Done when: every allowed and refused case in the design's test plan passes

- [x] 5. Cluster client and errors (R1.2 to R1.6, R1.8, R1.9, R2.2, R2.3)
  - Files: `frontend/src/opensearch/client.ts`, `errors.ts`, `client.test.ts`
  - Done when: one test per row of the error table passes with the exact message; refused calls never
    reach `fetch`; the password tests pass

- [x] 6. Connection provider (R1.1, R1.7, R2.1, R2.4, R4.2, R4.3)
  - Files: `frontend/src/components/ConnectionProvider.tsx`, `ConnectionProvider.test.tsx`
  - Done when: the four states, connect, disconnect, the 15 second health check and "lost" are tested

- [x] 7. Connect screen (R1.1 to R1.9, R2.2, R3.3)
  - Files: `frontend/src/screens/Connect/ConnectScreen.tsx`, `ConnectScreen.test.tsx`
  - Done when: tests cover empty, working, success and each error state, the cause list, the
    read-only tip, and the password field is empty after Connect

- [x] 8. Connection badge and disconnect (R4.1, R4.2, R4.3)
  - Files: `frontend/src/components/ConnectionBadge.tsx`, `ConnectionBadge.test.tsx`
  - Done when: the header shows name and health, Disconnect returns to the connect screen, and the
    lost state is shown

- [ ] 9. Practice cluster allows the app (setup)
  - Files: `dev/docker-compose.yml` (CORS settings for `http://localhost:5173`), `dev/README.md`
    (how to accept the certificate once)
  - Done when: `npm run dev` can connect to the practice cluster in a real browser

- [ ] 10. Manual check against the practice cluster (all)
  - Done when: every acceptance criterion was tried by hand (R5 by the design's "By hand, home page"
    list) and the result is written in `notes.md`
