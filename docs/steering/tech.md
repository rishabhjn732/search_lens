# Tech

This is the stack. To change it, edit this file first, then the spec, then the code,
and update `.claude/rules/frontend.md` to match.

| Part | Choice | Reason |
|---|---|---|
| App | React, TypeScript, Vite, runs only in the browser | Common, fast to start, no server to run |
| Drawing | SVG and CSS, D3 only where a layout is needed | Full control over animation |
| Tests | Vitest, React Testing Library, a fake `fetch` | Works with Vite, never needs a real cluster |
| Practice cluster | OpenSearch in Docker, one node | Safe place to try things |

## Browser-only: the browser calls OpenSearch directly

Decided by the user on 2026-10-03. An earlier plan had a small Python backend between the
browser and the cluster. It was removed to keep the tool simple to run.

What this means:

1. **CORS.** Browsers block a web page from calling another address unless that address allows it.
   Each cluster must allow calls from the address Search Lens runs on
   (`http.cors.enabled`, `http.cors.allow-origin`, `http.cors.allow-headers: Authorization,Content-Type`).
   The practice cluster in `dev/` is set up for this.
2. **Certificates.** A cluster with a self-signed certificate must be trusted by the browser first:
   open the cluster URL in a new tab once and accept it.
3. **Password.** The password is kept in page memory while the tab is open, and sent with every call.
   It is never written to browser storage. Anyone with the browser's developer tools on that
   computer can see it, so use Search Lens on your own computer.
4. **Read-only.** The read-only guard runs in the browser before each call. It stops mistakes in the
   tool, but a person who edits the page code could skip it. The real protection is to connect
   with a cluster user that can only read.

## Authentication

Version 1 supports username and password (HTTP basic auth) only.
AWS request signing for Amazon OpenSearch Service is not included yet.
