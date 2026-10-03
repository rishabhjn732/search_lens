---
name: spec-review
description: Review one spec for gaps before the user approves it
disable-model-invocation: true
argument-hint: <spec-number>
---

Review spec `$ARGUMENTS` before the user approves it.

1. Find the folder in `specs/` whose name starts with `$ARGUMENTS`.
2. Give the review to the `spec-reviewer` subagent. Tell it the folder path.
   It works in its own context, so this conversation stays small.
3. Show the user the subagent's findings, sorted by how serious they are.
4. Ask the user which findings to fix. Fix only those, in the spec files. Do not change any `Status:` line.
