# Notes: connect to a cluster

A new session reads this file to continue the work. Newest entry at the bottom.

## Task 1: Backend skeleton (setup)

- Built: FastAPI app in `backend/app/main.py` (`create_app()` plus a module-level `app`),
  `GET /api/health` returning `{ "data": "ok" }` in `backend/app/routes/health.py`,
  shared response models `DataResponse`, `ErrorBody`, `ErrorResponse` in `backend/app/models.py`,
  two tests in `backend/tests/test_health.py`.
- Decisions:
  - The health route lives in `app/routes/health.py`, not in `main.py`, to follow
    `.claude/rules/backend.md` ("routes live in `app/routes/`"). The task listed only `main.py`.
  - Packages are managed with `uv` (`pyproject.toml` with a `dev` dependency group).
    The virtual environment is `backend/.venv` (git-ignored). `uv` picked Python 3.12.
  - Tests call the app through `httpx.AsyncClient` + `httpx.ASGITransport` with `pytest.mark.anyio`,
    not FastAPI's `TestClient`, which now prints a deprecation warning. `tests/conftest.py`
    pins anyio to asyncio. Later route tests should use the same `make_client()` pattern.
- For the next session:
  - Run tests with `cd backend && uv run pytest`. Run the server with
    `cd backend && uv run uvicorn app.main:app --reload --port 8000`.
  - Git: `search-lens` now has its own repository (branch `main`, created 2026-10-03, pushed to
    `git@github.com:rishabhjn732/search_lens.git`). An empty, unused repository also exists in the home folder; it does not affect this one.
  - Next task: 2, Frontend skeleton.

## Task 2: Frontend skeleton (setup)

- Built: React 19 + TypeScript (strict) + Vite 8 app in `frontend/`. `src/App.tsx` shows a header
  ("Search Lens") and an empty `<main>`. `vite.config.ts` forwards `/api` to `http://localhost:8000`
  and holds the Vitest config (jsdom, `src/setupTests.ts`). `src/api/client.ts` exports `api.get`,
  `api.post`, `api.delete` and `ApiError` (`code`, `message`, `status`). Tests: `App.test.tsx` (2),
  `api/client.test.ts` (6). Checked by hand: `/api/health` through Vite returns `{"data":"ok"}`.
- Decisions:
  - `client.ts` has two client-side error codes that are not in the spec, for answers that never
    reach a backend route: `backend_unreachable` (fetch fails) and `unexpected_response` (body has
    neither `data` nor `error`). Their messages are in `client.ts`. If the user wants different
    wording, update the spec first.
  - `204 No Content` (for `DELETE /api/connection`) returns `undefined`.
  - `build` runs `tsc --noEmit` then `vite build`. Base CSS is in `src/index.css`; the real theme
    comes in task 3 (`src/styles/theme.css`).
- For the next session:
  - `npm audit` reports 2 moderate issues in `@vitest/mocker` (dev only, from Vitest 3.2.7).
    Fix: Vitest 5. `npm install -D vitest@5` fails with an npm bug ("edgesOut"); the fix is to set
    `"vitest": "^5.0.3"` in `package.json`, delete `node_modules` and `package-lock.json`, and
    run `npm install`. Deleting was blocked by permissions this session, so the user should do it.
  - Next task: 3, Home page. It adds `react-router-dom` and the `@fontsource` font packages.

## Plan change: browser-only (2026-10-03)

- The user chose to remove the backend. The browser now calls OpenSearch directly.
- Changed: `docs/steering/tech.md`, `structure.md`, `.claude/rules/cluster-safety.md`, the
  `opensearch-api` skill text, `CLAUDE.md`, and all three spec files (set back to `draft` for
  the user to approve again). Ids kept; R1.3, R1.4, R2.1 to R2.4, R3.1 reworded; R3.3 added.
- Tasks renumbered: the done "Frontend skeleton" is now task 1. The old backend task is gone, and
  the new task 2 deletes `backend/`, `frontend/src/api/` and the `/api` proxy.
  The two client-side codes from the old task 2 (`backend_unreachable`, `unexpected_response`)
  go away with `src/api/`.
- Not changed yet (task 2 does it): `README.md`, `docs/learning/`, `code-reviewer` agent,
  `spec-design` and `spec-tasks` skills, `.claude/rules/backend.md`, the code itself.
- 2026-10-03: the user approved all three spec files (browser-only version) by answering a question
  in the session; Claude changed the three `Status:` lines on their instruction.

## Task 2: Remove the backend (setup)

- Built (removed): `backend/` (via `git rm`), `.claude/rules/backend.md`, `frontend/src/api/`, the `/api`
  proxy in `vite.config.ts`. Updated the backend mentions in `README.md`, `.claude/rules/frontend.md`,
  `docs/learning/01` and `04`, the `code-reviewer` agent, the `spec-design` and `spec-tasks` skills,
  `specs/_templates/design.md` (its "Backend" section is now "Cluster code"), `specs/BACKLOG.md`,
  and the "How it works" text in `prototypes/home/a-clean-lab.html` (it said the backend holds the password).
- Decisions: `.claude/settings.json` denies `rm -rf`, so tracked files were removed with `git rm` and the
  user deletes the leftover `backend/` folder (`.venv`, caches; all git-ignored) by hand.
  `"Bash(pytest *)"` is still in the settings allow-list; harmless, can be removed later.
- For the next session: remaining "backend" words are history (`README.md`, `CLAUDE.md`, `tech.md`)
  or mean people ("backend developers" in `product.md`). Prototypes B and C still mention a backend;
  they are not used.

## Task 3: Home page (R5.1 to R5.8)

- Built: `react-router-dom` with `/` (HomeScreen) and `/connect` (`ConnectPlaceholder`, replaced in
  task 7). `App.tsx` exports `AppRoutes` (header + routes) so tests can use a `MemoryRouter`.
  `src/styles/theme.css` (colours, fonts via `@fontsource`, `.wrap`, `.btn`), `components/AppHeader`,
  `screens/Home/`: `HomeScreen`, `QueryDemo`, `ScreenCards` (`ready` flag; only Connect is a link),
  `HowItWorks` (3 steps, score picture, read-only sentence), `demoData.ts`, `home.css`.
  Tests: `HomeScreen.test.tsx` (7, one or more per criterion except R5.5 and R5.7), `App.test.tsx` (2).
- Decisions:
  - `QueryDemo` reads `demoData.ts` in the real `_analyze` explain shape. The removed "!" is found from
    gaps between token offsets; changed tokens are coloured by comparing with the step before.
    The Token playground can reuse this.
  - Header menu has "Home" and "Connect" only. The prototype's "Word lists" link belongs to the
    `custom-word-lists` spec; its in-page links were left out because they would not work from `/connect`.
  - No "Not connected" badge yet; `ConnectionBadge` comes in task 8.
  - The score picture's parts (run 4.61 + shoe 3.23 = 7.84) are fixed numbers in `HowItWorks.tsx`.
  - The old `App.test.tsx` test "main is empty" was replaced by "opens on the home page", because
    the spec now puts the home page there.
  - Below 900 px the screen cards are one column (the prototype used two), as R5.7 says.
- For the next session:
  - R5.5 (reduce motion) and R5.7 (narrow window) are CSS only; check them by hand (task 10).
  - Compare the page with `prototypes/home/a-clean-lab.html` by hand; it was not screenshotted.

## Task 4: Read-only guard (R3.1, R3.2)

- Built: `frontend/src/opensearch/guard.ts` with `isAllowed(method, path)`. Allow-list copied from
  `.claude/skills/opensearch-api/reference.md` ("Read-only guard" section): `GET`/`HEAD` always;
  `POST` only when the path (query string stripped) ends with `_search`, `_msearch`, `_count`,
  `_analyze`, `_validate/query`, `_search/template`, `_render/template`, `_field_caps`,
  `_termvectors`, `_mtermvectors`, `_rank_eval`, or matches `_explain/<doc_id>`. `PUT`, `DELETE`,
  `PATCH` always refused. Method check is case-insensitive.
  Tests: `guard.test.ts`, 22 tests, one per allowed suffix plus refused cases. All 84 project
  tests still pass.
- Branch: this task was started on a new branch `001-connect-cluster` (from `main`), because the
  session had been left on `007-mapping-lab` (a different spec).
## Task 5: Cluster client and errors (R1.2 to R1.6, R2.2, R2.3)

- Built: `frontend/src/opensearch/errors.ts` (`ClusterError { code, message, status?, body? }` plus one
  builder function per code, exact messages from the design's error table) and `client.ts`
  (`createClusterClient({ url, username, password })` → `{ request, connect }`). `request` checks
  the guard first, builds the full URL with `new URL(path, baseUrl)` (path only, so it cannot be
  pointed elsewhere), sends `Authorization: Basic ...` from a closure, `credentials: "omit"`, and a
  5 second `AbortController` timeout; maps 401/403/other non-2xx/abort/fetch-throw to the right
  `ClusterError`. `connect()` calls `GET /` then `GET /_cluster/health` and returns the combined
  facts. Password is never a field on the client, so `JSON.stringify` cannot show it.
  Tests: `client.test.ts`, 10 tests (one per error row, headers, credentials, facts, password safety).
- For the next session: Next task: 6, Connection provider.

## Task 6: Connection provider (R1.1, R1.7, R2.1, R2.4, R4.2, R4.3)

- Built: `frontend/src/components/ConnectionProvider.tsx`. React context holding `state`
  (`not_connected`/`connecting`/`connected`/`lost`), `facts`, and the client in a `useRef` (never in
  state, so it is not serialised). `connect(details)` creates the client, awaits `client.connect()`,
  on failure goes back to `not_connected` and rethrows (the screen shows the message). `disconnect()`
  forgets the client and facts. `request()` proxies to the client and moves to `lost` if a call fails
  with `unreachable` or `timeout`. A `setInterval` (15 s) while `connected` repeats the health check
  and also moves to `lost` on the same two error codes.
  Tests: `ConnectionProvider.test.tsx`, 6 tests. Fake timers + `vi.advanceTimersByTimeAsync` for the
  15 s check; used direct state checks after `act()` instead of RTL `waitFor` (that mixed badly with
  fake timers and hung the test for 5 s).
- For the next session: Next task: 7, Connect screen.

## Task 7: Connect screen (R1.1 to R1.7, R2.2, R3.3)

- Built: `frontend/src/screens/Connect/ConnectScreen.tsx` + `connect.css`, replacing
  `ConnectPlaceholder.tsx` (deleted). Form (URL, username, password), read-only tip (R3.3) always
  shown, Connect button disabled and labelled "Connecting…" while `state === 'connecting'` (R1.7).
  Password state is cleared the instant Connect is chosen, win or lose (R2.2). On failure shows
  `error.message`; `unreachable` and `timeout` get an extra cause list (R1.4), `unreachable`'s list
  includes a link to open the cluster URL. On success shows cluster name, distribution, version,
  node count and health, from `facts` (R1.1). `App.tsx` now wraps the routes in `ConnectionProvider`
  and uses `ConnectScreen` instead of the placeholder.
  Tests: `ConnectScreen.test.tsx`, 9 tests (empty, working, success, R1.2/R1.3/R1.5/R1.6 errors,
  R1.4 cause list, password cleared). The `timeout` test uses fake timers
  (`vi.advanceTimersByTimeAsync(5000)`) instead of a real 5 second wait.
  `npm run build` (tsc + vite) passes.
- For the next session: Next task: 8, Connection badge and disconnect.

## Task 8: Connection badge and disconnect (R4.1, R4.2, R4.3)

- Built: `frontend/src/components/ConnectionBadge.tsx` + `.css`, placed in `AppHeader.tsx` (the old
  placeholder comment is gone). Renders nothing in `not_connected`/`connecting`. In `connected`:
  cluster name, a coloured health word (`health-green`/`health-yellow`/`health-red` classes from
  `facts.status`), and a Disconnect button that calls `disconnect()` and navigates to `/connect`
  (R4.1, R4.2). In `lost`: "Connection lost" and a "Connect again" button, same disconnect+navigate
  action (R4.3).
  Tests: `ConnectionBadge.test.tsx`, 4 tests, using a small test harness component (exposes
  `connect()` from context) inside a `MemoryRouter` with a `/connect` stub route, to check the
  badge's states and that Disconnect/Connect again really navigate there.
  Full suite: 113/113 tests pass; `npm run build` passes.
- Branch note: this and tasks 4 to 7 were all done on `001-connect-cluster` (branched from `main`),
  not `007-mapping-lab` which the session had been left on.
- For the next session:
  - Tasks 4 to 8 are all done. Remaining: task 9 (CORS settings on the practice cluster's
    `dev/docker-compose.yml`, needs Docker) and task 10 (manual check against the practice cluster
    in a real browser) — both need the user's own machine, not done in this session.
  - Nothing was checked by hand yet: connecting to a real cluster, a wrong password, the cluster
    stopped, an untrusted certificate, and CORS turned off (design's "By hand" list) still need a
    real run with `npm run dev` against the practice cluster.

## Spec change: optional username and password (R1.8, R1.9)

- The user wants to connect to their own cluster directly (not the `dev/` practice cluster, so
  task 9's Docker/CORS setup is on hold), and that cluster may have no security plugin, so there is
  no username or password to give.
- `requirements.md`, `design.md`, `tasks.md` were put back to `draft`, R1.1 no longer requires
  username/password, R1.8 and R1.9 were added, and the user approved all three back to `approved`
  in the same conversation (R1.9: "Enter both username and password, or leave both empty.").
- Built: `errors.ts` got `credentials_incomplete`. `client.ts`'s `createClusterClient` now throws
  `credentials_incomplete` before any call when only one of username/password is filled in, and
  sends no `Authorization` header at all when both are empty. `ConnectScreen.tsx` dropped
  `required` from the username/password inputs and added a hint ("leave empty if the cluster needs
  no login"); no other screen logic changed, since the new error is shown the same way as the
  others already were.
  Tests: 3 new in `client.test.ts`, 2 new in `ConnectScreen.test.tsx`. Full suite 118/118 pass;
  `npm run build` passes.
- For the next session:
  - Still on hold, needs the user's own machine: task 9 (practice cluster CORS, if they go back to
    using `dev/`) and task 10 (manual check in a real browser — now against their own cluster,
    possibly with no login at all).
  - Nothing has been committed to git yet.

## Task 11: Remember the URL and username (added mid-spec-002-session)

- The user asked (while using spec 002's overview screen) for auto-connect from a saved password.
  That was refused outright — it directly breaks R2.1/R2.2/R2.4, which exist specifically so this
  tool stays safe to point at a real cluster. Offered the lesser version instead (remember URL
  and username only, never the password) and the user agreed. R6 was added to this spec's
  requirements.md (moving "Saving connections for next time" out of Out of scope, since that bullet
  no longer described reality), design.md got a new subsection, and this task was added and built.
- Built: `ConnectScreen.tsx` reads one `localStorage` key (`searchlens.connect.v1`, a plain
  `{url, username}` JSON object) once on mount via `useState(readRemembered)`, and writes to it
  only right after `connect()` succeeds — never on every keystroke, never including the password.
  `readRemembered()` treats a missing key or broken JSON the same as "nothing remembered" (empty
  form), so there's no new failure mode for a first-time user or anyone with old/foreign data in
  that key.
  `disconnect()` (`ConnectionBadge.tsx`, `ConnectionProvider.tsx`) was not touched — it never held
  anything from this key, so there was nothing to change there; added a test confirming the key
  survives a Disconnect rather than assuming it.
- Decisions: one `localStorage` key holding the single most recent `{url, username}`, not a list
  of past connections — matches the out-of-scope note and keeps this a small addition rather than
  a new "connection history" feature.
- Tests: 5 new in `ConnectScreen.test.tsx` (remembers on success, password never in storage,
  pre-fills from a stored value, empty form when nothing stored, empty form when storage is
  broken JSON), 1 new assertion added to `ConnectionBadge.test.tsx`'s existing Disconnect test.
  Full suite 324/324 pass (this count includes spec 002's cluster-overview work from the same
  session); `npm run build` passes.
- For the next session: unrelated to this task, tasks 9 and 10 are still the ones on hold,
  needing the user's own machine/browser.
