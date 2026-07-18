"""Health check endpoints."""
from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter()

@router.get("")
async def check_health():
    """Simple health check endpoint."""
    settings = get_settings()
    return {
        "status": "ok",
        "service": "aiva-workers",
        "env": settings.node_env
    }
