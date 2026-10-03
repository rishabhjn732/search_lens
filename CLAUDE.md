# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Search Lens

A debugging and teaching tool for OpenSearch. It shows how a query becomes tokens,
why a document matched, and how the score was built.

@docs/steering/product.md
@docs/steering/tech.md
@docs/steering/structure.md

## How we work: spec first

This project uses Spec Driven Development. No feature code is written without an approved spec.

1. Every feature lives in `specs/<number>-<name>/`.
2. Files are written in this order: `requirements.md`, then `design.md`, then `tasks.md`.
3. Each file has a `Status:` line near the top: `draft` or `approved`.
   Only the user changes a status to `approved`. Never change it yourself.
4. Do not start a later step while the earlier file is `draft`. Say what is missing and stop.
5. When implementing, do one task from `tasks.md`, tick it, then stop and report.
6. If the code needs something the spec does not say, stop and ask.
   The spec is updated first, then the code.

Skills for this flow: `/spec-new`, `/spec-requirements`, `/spec-design`, `/spec-tasks`,
`/spec-implement`, `/spec-review`, `/spec-status`.

## Commands

Run `cd frontend && npm install` once first. There is no backend (see `docs/steering/tech.md`).

- Tests: `cd frontend && npm test`
- One test file: `cd frontend && npx vitest run src/screens/Connect/ConnectScreen.test.tsx`
- Run: `cd frontend && npm run dev`, then open http://localhost:5173
- Type check and build: `cd frontend && npm run build`
- Local practice cluster: `docker compose -f dev/docker-compose.yml up -d`, then `bash dev/seed.sh`
  to load the `products` index and the `product_search` template. Details in `dev/README.md`.

## Big picture

This is planned in spec 001 (`design.md`). Check that file and its `Status:` before you rely on it.

- Browser-only: the browser calls OpenSearch directly. No backend (user decision, 2026-10-03).
  Each cluster must allow the page's address in its CORS settings.
- All cluster calls go through `frontend/src/opensearch/client.ts`. It asks the read-only guard
  (`guard.ts`, allow-list in `.claude/skills/opensearch-api/reference.md`) first; refused calls are
  never sent and get the `read_only` error.
- The password lives only in page memory (the login header is kept in a closure). Never in
  browser storage, the console, or error messages. A reload means connecting again.
- Errors are `ClusterError { code, message }`. Codes and exact messages come from the spec.
- Screens draw from the raw OpenSearch response shape. `prototypes/` is a visual reference only,
  not production code.
- Use the `opensearch-api` skill for which OpenSearch APIs exist and which ones the guard allows.

## Rules that always apply

- The tool is read-only toward the cluster. Never add a call that writes, deletes,
  or changes cluster settings unless an approved spec says so.
- Never print, log, or store a cluster password. Never read `.env` files.
- One feature per session and per branch. Do not edit files that belong to another feature.
- Tests are written in the same task as the code they test.
- Keep `specs/<feature>/notes.md` up to date. A new session reads it to continue the work.

## The user

The user is learning Claude Code and Spec Driven Development with this project.
Before you act, say in simple English what you will do and why, with a small example.

## Session log

At the end of each session, add one entry here (newest first) and tell the user the name to set
with `/rename`. Resume an old session with `claude --resume` and pick it by name.
Keep each entry short; details belong in `specs/BACKLOG.md` or `specs/<feature>/notes.md`.

### 2026-10-03-home-and-word-lists-prototype
- Chose home page design A (`prototypes/home/a-clean-lab.html`). Designs B and C kept for reference.
- Built a working prototype of the Word lists tab (`prototypes/home/a-word-lists.html`):
  entities, protected words, synonyms, Hunspell; add/remove files and entries; file checks with
  line numbers (`prototypes/home/wordlists.js`); test files in `prototypes/home/samples/`.
- Decided: saved lists live in browser `localStorage` (~5 MB). Lists are sent inline in `_analyze`,
  never stored on the cluster.
- Open: Hunspell needs dictionaries on the node's disk; how entities map to OpenSearch.
  Both are written in `specs/BACKLOG.md` under `home-page` and `custom-word-lists`.
- Next: start development. The user wants the React app to open on the home page from
  `prototypes/home/a-clean-lab.html` (design A), not a blank Vite page. Spec 001 does not mention
  a home page yet and all three files are `draft`. Order:
  1. Add the home page to spec 001 (requirement, design for `src/screens/Home/`, a task).
  2. The user reviews and approves spec 001.
  3. `/spec-implement` task 1 (backend), task 2 (React app), then the home page task.
  The Word lists tab (`a-word-lists.html`) gets its own spec: `/spec-new custom-word-lists`.
  Git fixed later in the session: `search-lens` has its own repository on branch `main`.
- Later: task 1 (backend) and task 2 (React skeleton) built; repo pushed to
  `git@github.com:rishabhjn732/search_lens.git`. Then the user chose **browser-only, no backend**.
  Steering docs, rules and spec 001 were rewritten; spec 001 is back to `draft` for approval.
  User approved; task 2 (backend removed) and task 3 (home page in React) are done.
  Then spec 006 (custom word lists) was written from the prototypes, approved, and tasks 1–4 built:
  `src/wordlists/` (rules, store on localStorage), `/word-lists` page, home page section.
  62 tests pass. Next: user does 006 task 5 (manual check in a browser); then
  `/spec-implement 001` → task 4 (read-only guard). The user must delete the leftover
  `backend/` folder by hand (`rm -rf` is denied in `.claude/settings.json`).
- Earlier in the same session: step 1 done. Spec 001 now has R5 (home page), design for `/` and
  `/connect`, and task 3 "Home page" (old tasks 3 to 10 are now 4 to 11). Still `draft`.
