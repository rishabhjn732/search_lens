import httpx
import pytest

from app.main import create_app

pytestmark = pytest.mark.anyio


def make_client() -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=create_app())
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_health_returns_ok() -> None:
    async with make_client() as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"data": "ok"}


async def test_unknown_path_is_not_found() -> None:
    async with make_client() as client:
        response = await client.get("/api/nothing-here")

    assert response.status_code == 404
