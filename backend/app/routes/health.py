"""Health check for the backend itself. It does not call the cluster."""

from fastapi import APIRouter

from app.models import DataResponse

router = APIRouter()


@router.get("/api/health")
async def health() -> DataResponse[str]:
    return DataResponse[str](data="ok")
