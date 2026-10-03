# Notes: mapping lab

A new session reads this file to continue the work. Newest entry at the bottom.

## Requirements (2026-10-03)

- Written from `prototypes/lab/mapping-lab.html`, which the user approved as the look.
- User answers: both modes (browser copy without a cluster, exact `_analyze` when connected);
  own tests and the last pasted definition are kept in browser storage; word lists (006) are
  not used in this spec.
- The browser copy of analysis (`prototypes/lab/analyzer.js`) and the 100 tests
  (`prototypes/lab/samples.js`) are the starting point for the design.
- Exact mode needs spec 001 tasks 4 to 8 (guard, client, connection). The close-copy mode does not.
- Requirements approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.
- Open questions answered (user said yes to all proposals); written into requirements.md "Open questions".

## Design (2026-10-03)

- design.md written as draft. Browser-only mode comes first; cluster mode needs spec 001 tasks 4 to 8.
- New folder `src/analysis/` (port of the prototype engine), shared later with spec 003.
- Design approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.

## Tasks (2026-10-03)

- tasks.md written as draft: 10 tasks. 1 to 7 need no cluster; 8 and 9 wait for spec 001 tasks 4 to 6.
- Tasks approved by the user (2026-10-03); Claude changed the `Status:` line on their instruction.
