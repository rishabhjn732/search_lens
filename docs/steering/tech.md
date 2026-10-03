# Tech

This is the default stack. To change it, edit this file before the design of spec 001 is approved,
and update `.claude/rules/backend.md` and `.claude/rules/frontend.md` to match.

| Part | Choice | Reason |
|---|---|---|
| Backend | Python 3.11+, FastAPI, httpx | Small, async, easy to test with a fake cluster |
| Backend tests | pytest | Standard for Python |
| Frontend | React, TypeScript, Vite | Common, fast to start |
| Drawing | SVG and CSS, D3 only where a layout is needed | Full control over animation |
| Frontend tests | Vitest, React Testing Library | Works with Vite |
| Practice cluster | OpenSearch in Docker, one node | Safe place to try things |

## Why a backend is needed

The browser does not call OpenSearch directly, for two reasons:

1. The password would be visible in the browser.
2. OpenSearch usually blocks calls that come from a web page on another address.

So the browser calls the backend, and the backend calls OpenSearch.

## Authentication

Version 1 supports username and password (HTTP basic auth) only.
AWS request signing for Amazon OpenSearch Service is not included yet.
