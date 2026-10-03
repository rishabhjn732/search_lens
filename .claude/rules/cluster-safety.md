# Cluster safety

These rules have no `paths:` so they load in every session.

- Calls to OpenSearch go only through `frontend/src/opensearch/client.ts`. Components never call `fetch`.
- Every call passes the read-only guard (`src/opensearch/guard.ts`) before it is sent. The guard allows
  `GET` and `HEAD`, plus `POST` only to the read-style APIs listed in
  `.claude/skills/opensearch-api/reference.md`. Everything else is refused and never sent.
- The password lives only in page memory while the tab is open. It is not written to
  `localStorage`, `sessionStorage`, cookies, IndexedDB, the console, error messages, or test snapshots.
- The password is sent only to the cluster URL the user entered.
- In tests, never call a real cluster. Use a fake `fetch`.
- Error messages shown to the user say what went wrong and what to do next.
  They do not include stack traces or credentials.
