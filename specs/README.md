# Specs

One folder per feature. Each feature goes through the same four steps, in order.

| Step | File | Who writes it | Who approves it |
|---|---|---|---|
| 1. What do we need? | `requirements.md` | Claude, after asking you questions | You |
| 2. How will it work? | `design.md` | Claude | You |
| 3. What are the small steps? | `tasks.md` | Claude | You |
| 4. Build it | code and tests | Claude, one task at a time | You, by trying it |

To approve a file, change its `Status: draft` line to `Status: approved` yourself.

## Status board

Run `/spec-status` to refresh this table.

| Spec | Requirements | Design | Tasks done | Next action |
|---|---|---|---|---|
| 001-connect-cluster | draft | draft | 0 of 10 | you review and approve |
| 002-cluster-overview | missing | missing | missing | `/spec-requirements 002` |
| 003-token-playground | missing | missing | missing | `/spec-requirements 003` |
| 004-query-lab | missing | missing | missing | `/spec-requirements 004` |
| 005-load-monitor | missing | missing | missing | `/spec-requirements 005` |
| 007-mapping-lab | approved | approved | 7 of 10 | tasks 8 to 10 wait for spec 001 (tasks 4 to 6) |

Ideas for later features are in `BACKLOG.md`.
