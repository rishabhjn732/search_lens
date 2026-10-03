---
paths:
  - "specs/**"
---

# Rules for spec files

- Requirements say what the user needs. They do not name libraries, files, or functions.
- Each acceptance criterion uses this form: `WHEN <something happens> THE SYSTEM SHALL <result>`.
  For things that are always true: `THE SYSTEM SHALL <result>`.
- Each criterion can be checked by a test or by looking at the screen. If it cannot be checked, rewrite it.
- Requirement ids look like `R1`, `R2`. Criteria look like `R1.1`, `R1.2`. Ids never change once approved.
- `design.md` has a coverage table: every criterion id points to the part of the design that handles it.
- Each task in `tasks.md` lists the criterion ids it covers and can be finished in one sitting with passing tests.
- Do not change a `Status:` line. Only the user approves.
- Write specs in simple English.
