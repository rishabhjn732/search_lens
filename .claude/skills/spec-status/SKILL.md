---
name: spec-status
description: Show the status of every spec and the next action for each
disable-model-invocation: true
---

Show where every spec stands.

1. For each folder in `specs/` that starts with a number, read the `Status:` line of
   `requirements.md`, `design.md`, and `tasks.md` if they exist, and count ticked and unticked tasks.
2. Print one table with these columns: spec, requirements, design, tasks done, next action.
   Use `missing` when a file does not exist.
3. The next action is the first step that is not done:
   `/spec-requirements`, "you approve requirements", `/spec-design`, "you approve design",
   `/spec-tasks`, "you approve tasks", `/spec-implement`, or "done".
4. Update the table in `specs/README.md` so it matches.

Change nothing else.
