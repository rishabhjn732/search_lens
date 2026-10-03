# Exercises

Do them in order. Each one teaches one or two things about Claude Code while building one feature.
Commit after every exercise.

## Exercise 0: set up (15 minutes)

1. Put the project folder where you keep your code. Open a terminal in it.
2. Run `git init`, then `git add .`, then `git commit -m "Project skeleton"`.
3. Start Claude Code: `claude`
4. Ask: "What are the rules of this project?"
5. Type `/` and look at the list. Find the seven `spec-` skills.
6. Ask: "Read the file dev/.env". See how it is blocked.

You learned: `CLAUDE.md` is loaded by itself, skills appear as `/` commands, permissions really block.

## Exercise 1: build feature 001 from a finished spec

The spec for "connect to a cluster" is already written. You read, approve and build.

1. Read `specs/001-connect-cluster/requirements.md` yourself, slowly.
2. In Claude Code: `/spec-review 001`. Watch Claude send the work to the `spec-reviewer` helper.
3. Decide which findings to fix. Then open the three files and change `Status: draft` to `Status: approved`.
4. Start the practice cluster. See `dev/README.md`.
5. `/spec-implement 001`. Claude does task 1 and stops. Read what it did. Commit.
6. Repeat `/spec-implement 001` for each task. After task 5, close the session and start a new one.
   Notice that the new session continues correctly, because it reads `tasks.md` and `notes.md`.

You learned: the approval gate, one task at a time, permission prompts, and that a new session can continue from files.

Try this once: before step 3, run `/spec-implement 001` while the status is still `draft`.
Claude should refuse. That is the gate working.

## Exercise 2: write your first spec (feature 002)

Now you write the spec, with Claude's help.

1. New branch and new session: `git switch -c 002-cluster-overview`, then `claude`.
2. `/spec-requirements 002`. Claude asks you questions. Answer in your own words.
3. Read the result. Find one criterion that is not clear to you and ask Claude to rewrite it.
4. `/spec-review 002`, fix, approve.
5. New session. `/spec-design 002`. Approve.
6. New session. `/spec-tasks 002`. Approve.
7. `/spec-implement 002` until done.

You learned: the whole flow from idea to code, and using a new session for each step.

## Exercise 3: use a worktree (feature 003)

1. Commit everything.
2. `claude --worktree 003-token-playground`
3. Do the full flow for spec 003. Tell Claude to look at `prototypes/token-playground.html` for the look.
4. After a task is done, ask: "Use the code-reviewer subagent to review task 2 of spec 003."
5. When the feature is finished, merge the worktree branch into your main branch.

You learned: worktrees, and asking a subagent by name.

## Exercise 4: change the setup yourself (feature 004)

The query lab is big. Use it to practise changing the Claude Code files.

1. Ask Claude in plan mode whether spec 004 should be split into smaller specs. Use `/spec-new` for each part.
2. Write your own rule: create `.claude/rules/visualization.md` with `paths:` for the frontend screens.
   Put your rules for score pictures in it: colours, how numbers are rounded, what is shown first.
3. Write your own skill: create `.claude/skills/explain-sample/SKILL.md`. It should run a query against the
   practice cluster (for example with `curl`) and save the raw answer as a test file. Ask Claude to help you write it,
   and read the official skills page first: https://code.claude.com/docs/en/skills
4. Each time Claude makes a mistake that it could make again, add one line to `CLAUDE.md` or to a rule.

You learned: the setup is yours. You improve it when you see the same problem twice.

## Exercise 5: two features at the same time (feature 005)

1. Pick one idea from `specs/BACKLOG.md` and make a spec for it with `/spec-new`.
2. Write and approve the specs for 005 and for your new feature.
3. Open two terminals. Start one worktree session for each.
4. Let both run `/spec-implement`. Move between the terminals and check each task.
5. Merge both branches. If the same file was changed in both, solve the conflict with Claude's help.

You learned: running sessions in parallel, and why small tasks and separate files make this possible.

## After the exercises

Ideas to learn more: add a hook in `settings.json` that formats files after each edit,
connect a tool with MCP, or write a `CLAUDE.md` for another project of yours.
The official documentation starts here: https://code.claude.com/docs
