# Notes: connect to a cluster

A new session reads this file to continue the work. Newest entry at the bottom.

## Task 1: Backend skeleton (setup)

- Built: FastAPI app in `backend/app/main.py` (`create_app()` plus a module-level `app`),
  `GET /api/health` returning `{ "data": "ok" }` in `backend/app/routes/health.py`,
  shared response models `DataResponse`, `ErrorBody`, `ErrorResponse` in `backend/app/models.py`,
  two tests in `backend/tests/test_health.py`.
- Decisions:
  - The health route lives in `app/routes/health.py`, not in `main.py`, to follow
    `.claude/rules/backend.md` ("routes live in `app/routes/`"). The task listed only `main.py`.
  - Packages are managed with `uv` (`pyproject.toml` with a `dev` dependency group).
    The virtual environment is `backend/.venv` (git-ignored). `uv` picked Python 3.12.
  - Tests call the app through `httpx.AsyncClient` + `httpx.ASGITransport` with `pytest.mark.anyio`,
    not FastAPI's `TestClient`, which now prints a deprecation warning. `tests/conftest.py`
    pins anyio to asyncio. Later route tests should use the same `make_client()` pattern.
- For the next session:
  - Run tests with `cd backend && uv run pytest`. Run the server with
    `cd backend && uv run uvicorn app.main:app --reload --port 8000`.
  - Git: `search-lens` now has its own repository (branch `main`, created 2026-10-03, no commits
    yet). An empty, unused repository also exists in the home folder; it does not affect this one.
  - Next task: 2, Frontend skeleton.
