---
name: spec-design
description: Write design.md for one spec from its approved requirements
disable-model-invocation: true
argument-hint: <spec-number>
---

Write the design for spec `$ARGUMENTS`.

## Check first

1. Find the folder in `specs/` whose name starts with `$ARGUMENTS`.
2. Read `requirements.md`. If its status is not `approved`, say so and stop.
3. If it still has open questions that change the design, list them and stop.

## Learn before designing

4. Read `docs/steering/`, the rules in `.claude/rules/`, and the code that already exists.
   Reuse what is there instead of adding a second way to do the same thing.
5. For the OpenSearch calls, use the `opensearch-api` skill and its `reference.md`.

## Writing

6. Write `design.md` from `specs/_templates/design.md`. It must have:
   - A short overview in simple English.
   - Each OpenSearch API call: method, path, the important parameters, and a small example response.
   - Backend routes: path, request body, response body, error codes.
   - Frontend parts: screens, components, what data each one needs.
   - How errors and empty states are shown.
   - A test plan: what is tested with fake cluster responses, and what is checked by hand.
   - The coverage table: every criterion id from `requirements.md` and where the design handles it.
7. If two approaches are possible, name both in "Decisions", pick one, and give the reason in one sentence.
8. Set `Status: draft`.

## After writing

9. Tell the user which criterion ids were hardest to cover and why.
10. Stop. The next step, after the user approves, is `/spec-tasks $ARGUMENTS`.

Do not write tasks or code in this step.
