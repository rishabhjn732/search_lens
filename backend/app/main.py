"""Search Lens backend. Run with: uvicorn app.main:app --reload --port 8000"""

from fastapi import FastAPI

from app.routes import health


def create_app() -> FastAPI:
    app = FastAPI(title="Search Lens")
    app.include_router(health.router)
    return app


app = create_app()
