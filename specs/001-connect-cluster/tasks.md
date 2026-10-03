# Tasks: connect to a cluster

Status: approved

Do the tasks in order. One task per `/spec-implement` run.

- [x] 1. Backend skeleton (setup)
  - Files: `backend/pyproject.toml`, `backend/app/main.py`, `backend/tests/test_health.py`
  - Done when: `GET /api/health` returns `{ "data": "ok" }` and `pytest` passes

- [ ] 2. Frontend skeleton (setup)
  - Files: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/App.tsx`, `frontend/src/api/client.ts`
  - Done when: the app shows an empty page with a header, `/api` is forwarded to port 8000, and `npm test` passes

- [ ] 3. Home page (R5.1 to R5.8)
  - Files: `frontend/src/styles/theme.css`, `frontend/src/components/AppHeader.tsx`,
    `frontend/src/screens/Home/HomeScreen.tsx`, `QueryDemo.tsx`, `ScreenCards.tsx`, `HowItWorks.tsx`,
    `demoData.ts`, `HomeScreen.test.tsx`; router set up in `frontend/src/App.tsx`
    (`/connect` shows a placeholder until task 9)
  - Done when: the tests in the design's "Automatic, home page" list pass, and the page looks like
    `prototypes/home/a-clean-lab.html` without the word lists section

- [ ] 4. Connection store and connect, success case (R1.1, R2.1, R2.4)
  - Files: `backend/app/opensearch/connection.py`, `backend/app/routes/connection.py`, `backend/tests/test_connection.py`
  - Done when: `POST /api/connection` against a fake cluster returns the cluster facts and sets the cookie

- [ ] 5. Connect, error cases (R1.2, R1.3, R1.4, R1.5, R1.6)
  - Files: `backend/app/opensearch/errors.py`, `backend/tests/test_connection_errors.py`
  - Done when: one test per row of the error mapping table passes, with the exact messages

- [ ] 6. Password safety (R2.2)
  - Files: `backend/app/opensearch/connection.py`, `backend/tests/test_password_safety.py`
  - Done when: tests prove the password is absent from `repr`, from captured logs, and from error bodies

- [ ] 7. Read connection and disconnect (R4.1, R4.2, R4.3)
  - Files: `backend/app/routes/connection.py`, `backend/tests/test_connection.py`
  - Done when: `GET` reports connected, not connected and lost; `DELETE` removes the entry and closes the client

- [ ] 8. Read-only proxy (R3.1, R3.2)
  - Files: `backend/app/opensearch/guard.py`, `backend/app/routes/proxy.py`, `backend/tests/test_guard.py`
  - Done when: allowed calls are forwarded unchanged and refused calls get `read_only` without reaching the fake cluster

- [ ] 9. Connect screen (R1.1 to R1.7, R2.3)
  - Files: `frontend/src/screens/Connect/ConnectScreen.tsx`, `ConnectScreen.test.tsx`
  - Done when: tests cover empty, working, success and each error state, and the password field is empty after sending

- [ ] 10. Connection badge and disconnect (R4.1, R4.2, R4.3)
  - Files: `frontend/src/components/ConnectionBadge.tsx`, `frontend/src/components/ConnectionProvider.tsx`, tests
  - Done when: the header shows name and health, Disconnect returns to the connect screen, and the lost state is shown

- [ ] 11. Manual check against the practice cluster (all)
  - Done when: every acceptance criterion was tried by hand (R5 by the design's "By hand, home page"
    list) and the result is written in `notes.md`
