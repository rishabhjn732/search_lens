# Lesson 2: Spec Driven Development in simple words

## The problem it solves

If you tell an AI "build me a connect screen", it will build something. But it has to guess a lot:
What happens with a wrong password? Where is the password kept? What if the cluster is slow?
Every guess can be wrong, and you find out late, after the code exists.

Spec Driven Development means: write down what you want first, agree on it, and only then build.

## The house example

You do not tell a builder "build me a house" and come back in six months.

1. **Requirements.** You say what the family needs: three bedrooms, a kitchen with a window,
   no stairs for grandmother. You do not say which bricks to use.
2. **Design.** The architect draws the plan. Now you can see problems on paper,
   where fixing them costs nothing.
3. **Tasks.** The builder makes a work list: foundation, walls, roof, wiring. One step at a time.
4. **Build.** After each step, someone checks it against the plan.

In this project the three papers are three files in one folder:

```
specs/001-connect-cluster/
  requirements.md   what the user needs
  design.md         how it will work
  tasks.md          the small steps
  notes.md          a diary, written while building
```

## How to write one requirement

Each requirement has a short story and some acceptance criteria.
An acceptance criterion is one sentence that can be checked. It has this form:

> WHEN something happens THE SYSTEM SHALL do this.

Restaurant example: "WHEN the customer presses the bell THE WAITER SHALL come within one minute."
You can check this with a watch. Compare it with "the service should be good". Nobody can check that.

From spec 001:

> R1.2 WHEN the username or password is wrong THE SYSTEM SHALL show
> "The username or password is wrong." and stay on the connect screen.

A test can check this exactly. That is the goal.

## The gate between steps

Each file has a line `Status: draft`. Claude never changes it. You change it to `Status: approved`
when you have read the file and agree. Claude will not start the next step before that.

This gate is the most important part. Reading a requirements file takes ten minutes.
Finding the same mistake in finished code takes a day.

## The commands in this project

| You type | What happens |
|---|---|
| `/spec-new my-feature` | Makes a new folder with a short brief |
| `/spec-requirements 002` | Claude asks you questions, then writes `requirements.md` |
| `/spec-review 002` | A helper checks the spec for gaps |
| `/spec-design 002` | Claude writes `design.md` |
| `/spec-tasks 002` | Claude writes `tasks.md` |
| `/spec-implement 002` | Claude builds the next open task, then stops |
| `/spec-status` | Shows where every spec stands |

## When the spec turns out to be wrong

This will happen, and it is normal. The rule is: change the spec first, then the code.

Example: while building, Claude finds that the cluster answers `403` for some users.
The spec did not think of this. Claude stops and tells you. You add a criterion to
`requirements.md`, the design gets one more row, and then the code is written.
Now the spec is still true, and the next session can trust it.

## Common mistakes

- **Writing "how" in the requirements.** "Use a cookie" is design. "The browser does not keep the password" is a requirement.
- **Criteria that cannot be checked.** "Fast" is not checkable. "Within 5 seconds" is.
- **Forgetting what goes wrong.** For every criterion, ask "and if it fails?".
- **Tasks that are too big.** If a task takes more than one sitting, split it.
- **Approving without reading.** Then the spec is only decoration.
