---
name: spec-new
description: Create a new feature spec folder with a brief, using the next free number
disable-model-invocation: true
argument-hint: <feature-name-in-kebab-case>
---

Create a new spec for the feature named `$ARGUMENTS`.

1. List the folders in `specs/`. Find the highest number. The new number is that plus one, written with 3 digits.
2. Create the folder `specs/<number>-$ARGUMENTS/`.
3. Ask the user to describe the feature in a few sentences: who needs it, and what problem it solves.
4. Write `brief.md` in the new folder from `specs/_templates/brief.md`, using the user's words.
5. Add one row for the new spec to the table in `specs/README.md`.
6. Stop. Tell the user the next step is `/spec-requirements <number>`, in a new session if this one is already long.

Do not write requirements, design, tasks, or code in this step.
