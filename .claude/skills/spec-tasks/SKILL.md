---
name: spec-tasks
description: Write tasks.md for one spec from its approved design
disable-model-invocation: true
argument-hint: <spec-number>
---

Write the task list for spec `$ARGUMENTS`.

1. Find the folder in `specs/` whose name starts with `$ARGUMENTS`.
2. Read `requirements.md` and `design.md`. If either status is not `approved`, say which one and stop.
3. Write `tasks.md` from `specs/_templates/tasks.md`. Rules for tasks:
   - Each task is small: one piece of behaviour, finished in one sitting, with tests passing at the end.
   - Each task lists the criterion ids it covers, like `(R1.1, R1.2)`.
   - Each task lists the main files it will create or change.
   - Order them so that each task builds on finished ones. Backend before the screen that needs it.
   - The last task is a manual check against the local practice cluster.
   - Every criterion id in `requirements.md` appears in at least one task.
4. Set `Status: draft`.
5. Stop. Tell the user the number of tasks and ask them to approve.
   The next step is `/spec-implement $ARGUMENTS`.

Do not write code in this step.
