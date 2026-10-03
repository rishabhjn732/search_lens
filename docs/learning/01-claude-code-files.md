# Lesson 1: what each Claude Code file does

Claude Code reads some files from your project by itself. Each file has a different job.
Think of the project as an office and Claude as a new colleague.

| File or folder | Its job | Real-life picture | When Claude reads it |
|---|---|---|---|
| `CLAUDE.md` | The main instructions for the project | The notice board at the office door. Everyone reads it every morning. | At the start of every session |
| `.claude/rules/` | Extra instructions for one area | A sign on one room: "wear gloves in the kitchen". You read it only when you enter that room. | When Claude opens a file that matches the rule's `paths:`. A rule without `paths:` is read every session. |
| `.claude/skills/` | Reusable step-by-step instructions | Recipe cards. You take one out when you cook that dish. | When you type `/skill-name`, or when Claude sees the skill fits the job |
| `.claude/agents/` | Helpers with their own memory space | A specialist you send to another room. They come back with a short report. | When you or Claude ask that helper to do something |
| `.claude/settings.json` | What Claude may and may not do | The locks on the doors. Not advice. They really block. | Always. Claude Code applies it. |
| `.claude/output-styles/` | How Claude talks to you | Asking a colleague to speak slowly and give examples. | Every answer, when the style is selected |

## The same thing, in this project

- `CLAUDE.md` says: "write the spec first" and "never change the cluster".
- `.claude/rules/frontend.md` starts with `paths: frontend/**`. Claude reads it only when it works on frontend files.
  This keeps Claude's memory space free when it works on specs or docs.
- `.claude/skills/spec-requirements/SKILL.md` is the recipe for writing a requirements file.
  You start it by typing `/spec-requirements 002`.
- `.claude/agents/spec-reviewer.md` is a helper that can only read files (`tools: Read, Grep, Glob`).
  It checks a spec and reports back.
- `.claude/settings.json` blocks reading `.env` files and blocks `git push`.
  Even if Claude wanted to, it cannot.
- `.claude/output-styles/simple-english.md` asks Claude to use simple English and examples.

## Advice or lock?

This difference is important.

- `CLAUDE.md`, rules and skills are **advice**. Claude reads them and usually follows them.
- `settings.json` permissions are a **lock**. They are enforced by the program.

Example: "Never read the password file" written in `CLAUDE.md` is advice.
`"deny": ["Read(./.env)"]` in `settings.json` is a lock. For secrets, use the lock.

## Try it

Start Claude Code in the project folder and ask these questions:

1. "What are the rules of this project?" Claude answers from `CLAUDE.md`.
2. "Which skills do you have here?" Or type `/` and look at the list.
3. "Read the file dev/.env." Claude is blocked. This is the lock working.

## Keep `CLAUDE.md` short

It is read in every session, so every line costs memory space every time.
A good target is under 200 lines. When it grows, move parts into rules or skills.

Official page with every file explained: https://code.claude.com/docs/en/claude-directory
