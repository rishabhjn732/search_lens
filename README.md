# Search Lens

A tool that shows, in pictures, how OpenSearch handles a search: how text becomes tokens,
why a document matched, and how its score was built.

This folder is also a practice project for learning Claude Code and Spec Driven Development.
The app code is not written yet. You will build it feature by feature, with a spec for each one.

## Start here

1. Read `docs/learning/01-claude-code-files.md`. It explains every file in `.claude/`.
2. Read `docs/learning/02-spec-driven-development.md`. It explains the way of working.
3. Read `docs/learning/03-sessions.md`. It explains why each feature gets its own session.
4. Do the exercises in `docs/learning/04-exercises.md`, in order.

## What you need

- Claude Code. See the official documentation: https://code.claude.com/docs
- Git
- Node.js, for the app (it runs only in the browser, there is no backend)
- Docker, for the practice cluster

## What is in the folder

| Path | What it is |
|---|---|
| `CLAUDE.md` | Project instructions that Claude reads in every session |
| `.claude/settings.json` | What Claude may and may not do here |
| `.claude/rules/` | Extra instructions for the frontend, specs, and cluster safety |
| `.claude/skills/` | The `/spec-...` commands and the OpenSearch API reference |
| `.claude/agents/` | Two helpers: `spec-reviewer` and `code-reviewer` |
| `.claude/output-styles/` | Asks Claude to answer in simple English with examples |
| `docs/steering/` | What the product is and which technology it uses |
| `docs/learning/` | The lessons and exercises |
| `specs/` | One folder per feature. `001` is fully written as an example. |
| `prototypes/token-playground.html` | A working picture of the token screen. Open it in a browser. |
| `dev/` | The practice cluster and sample data |

## The features

| Spec | Feature | State |
|---|---|---|
| 001 | Connect to a cluster | Spec written, waiting for your approval |
| 002 | Cluster overview | Brief only. You write the spec. |
| 003 | Token playground | Brief and prototype |
| 004 | Query lab | Brief only |
| 005 | Load monitor | Brief only |

## Changing the technology

Search Lens is a React app that runs only in the browser and calls OpenSearch directly.
An earlier plan had a Python backend; it was removed on 2026-10-03 (see `docs/steering/tech.md`).
To change the technology, edit `docs/steering/tech.md` and `.claude/rules/frontend.md` first,
then ask Claude to update the spec to match, then the code.
