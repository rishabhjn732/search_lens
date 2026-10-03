---
name: spec-implement
description: Implement the next open task of one spec, then stop
disable-model-invocation: true
argument-hint: <spec-number> [task-number]
---

Implement one task of spec `$0`. If a task number is given (`$1`), do that task. If not, do the first unticked task.

## Check first

1. Find the folder in `specs/` whose name starts with `$0`.
2. Read `requirements.md`, `design.md`, `tasks.md`, and `notes.md` if it exists.
   If any of the first three is not `approved`, say which one and stop.
3. Tell the user which task you will do, which criterion ids it covers, and which files you expect to touch.

## Do the task

4. Write the tests for the task and the code, following `design.md` and the rules in `.claude/rules/`.
5. Run the tests. If they fail, fix the code. Do not weaken a test to make it pass.
6. If you find that the design is wrong or something is missing, stop and tell the user.
   Do not quietly build something different from the spec.

## Finish

7. Tick the task in `tasks.md`: change `- [ ]` to `- [x]`.
8. Add an entry to `notes.md` in the spec folder (create it from `specs/_templates/notes.md` if needed):
   the task number, what was built, decisions made, and anything the next session must know.
9. Tell the user: what changed, how to try it by hand, and a commit message they can use.
10. Stop. Do not start the next task. The user runs `/spec-implement $0` again when ready.
