---
paths:
  - "backend/**"
---

# Backend rules

- Python 3.11+, FastAPI, `httpx.AsyncClient` for calls to OpenSearch, `pytest` for tests.
- Type hints on every function. Request and response bodies are Pydantic models.
- Routes live in `app/routes/`, OpenSearch calls in `app/opensearch/`, shared models in `app/models.py`.
- Routes return `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "..." } }` on failure.
- Tests use `httpx.MockTransport` to fake the cluster. One test file per route file.
- A timeout is set on every outgoing call. Default: 5 seconds.
