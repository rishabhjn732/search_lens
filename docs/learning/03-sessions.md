# Lesson 3: one session per feature

## What a session is

A session is one conversation with Claude Code. Everything Claude has read and said in it sits in
its working memory, called the context. The context has a size limit.

Think of the context as a desk. Every file and every answer is a paper on the desk.
When the desk is full of papers from three different jobs, it is hard to work well on any of them.
So: one job, one clean desk.

In this project:

> one feature = one spec folder = one git branch = one session (or a few, one after another)

## Why specs make this easy

A new session knows nothing about the old one. That sounds like a problem, but the spec fixes it.
Everything important is in files: the requirements, the design, the ticked tasks, and `notes.md`.
A new session reads those files and continues. The spec is the memory, not the conversation.

## The simple way: one feature at a time

```
git switch -c 002-cluster-overview
claude
```

Then in Claude Code: `/spec-requirements 002`.

Useful things:

| What | How |
|---|---|
| Start with a clean desk without leaving | `/clear` |
| Come back to the last session in this folder | `claude --continue` |
| Choose an older session from a list | `claude --resume` |
| Let Claude only read and plan, not edit | plan mode: press Shift+Tab to switch modes, or start with `claude --permission-mode plan` |
| Open and edit `CLAUDE.md` | `/memory` |

A good habit: start a new session for each of the four steps of a big feature.
One for requirements, one for design, one for tasks, and then one for every two or three tasks.
Before you close a session, ask: "Is notes.md up to date?"

## The parallel way: two features at once

Git has a feature called a worktree: a second copy of your project folder, on its own branch.
Claude Code can make one for you:

```
claude --worktree 004-query-lab
```

This makes the folder `.claude/worktrees/004-query-lab/` on a new branch `worktree-004-query-lab`
and starts a session inside it. Open a second terminal and run:

```
claude --worktree 005-load-monitor
```

Now two sessions work at the same time and cannot disturb each other, because each has its own files.

Three things to know:

1. A worktree is made from what is committed. Commit your specs before you start one.
2. To return later, use the `claude --worktree <name> --resume` command that Claude Code prints when you exit.
3. When the feature is finished, merge its branch into your main branch like any other branch.

Real-life picture: two cooks, two kitchens, one recipe book. They do not bump into each other,
and at the end both dishes go to the same table.

Official page: https://code.claude.com/docs/en/worktrees

## When to start a new session

- You move to another feature.
- You move to the next step (requirements to design, design to tasks).
- Claude starts to forget things you said earlier, or mixes up files.
- You come back the next day. Read `notes.md` together with Claude first.
