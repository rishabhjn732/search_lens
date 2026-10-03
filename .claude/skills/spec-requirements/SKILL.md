---
name: spec-requirements
description: Write requirements.md for one spec by asking the user questions first
disable-model-invocation: true
argument-hint: <spec-number>
---

Write the requirements for spec `$ARGUMENTS`.

## Before writing

1. Find the folder in `specs/` whose name starts with `$ARGUMENTS`. If there is none, say so and stop.
2. Read `brief.md` in that folder, the files in `docs/steering/`, and the requirements of earlier specs,
   so the new spec fits with what exists.
3. Ask the user questions about what the brief does not decide. Ask one question at a time, at most five.
   Good topics: who uses it, what they see when it works, what can go wrong, what is not included.
   Wait for each answer.

## Writing

4. Write `requirements.md` from `specs/_templates/requirements.md`.
5. Follow `.claude/rules/specs.md`. The most important points:
   - Say what the user needs, not how to build it. No library names, no file names.
   - Each acceptance criterion is `WHEN <something happens> THE SYSTEM SHALL <result>` and can be checked.
   - Include what happens when things go wrong: empty data, slow cluster, missing permission.
   - List what is out of scope.
   - Put anything you are unsure about under "Open questions". Do not guess silently.
6. Set `Status: draft`.

## After writing

7. Show the user a short summary: how many requirements, and the open questions.
8. Stop. Tell the user to read the file, edit it, and change the status to `approved` when happy.
   The next step is `/spec-design $ARGUMENTS`.

Do not write the design, the tasks, or any code in this step.
