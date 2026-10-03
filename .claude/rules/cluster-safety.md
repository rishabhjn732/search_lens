# Cluster safety

These rules have no `paths:` so they load in every session.

- Calls to OpenSearch go only through the backend proxy. The browser never calls the cluster.
- The proxy allows `GET` and `HEAD`, plus `POST` only to the read-style APIs listed in
  `.claude/skills/opensearch-api/reference.md`. Everything else is rejected.
- Passwords live only in backend memory for the life of the connection. They are not written
  to disk, logs, error messages, test snapshots, or browser storage.
- In tests, never call a real cluster. Use a fake HTTP transport.
- Error messages shown to the user say what went wrong and what to do next.
  They do not include stack traces or credentials.
