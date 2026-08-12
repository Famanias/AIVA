import time
import structlog
from app.core.db import get_db_pool

logger = structlog.get_logger(__name__)

class CancellationError(Exception):
    pass

class PauseError(Exception):
    pass

class LifecycleService:
    _cache = {}
    _cache_ttl_sec = 2.0

    @classmethod
    async def check_lifecycle_async(cls, job_id: str) -> dict:
        now = time.time()
        cached = cls._cache.get(job_id)

        if cached and cached["expires_at"] > now:
            return cached["state"]

        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT cancel_requested_at, pause_requested_at FROM public.jobs WHERE id = $1 LIMIT 1",
                    job_id
                )
                
            is_cancelled = False
            is_paused = False
            
            if row:
                is_cancelled = row["cancel_requested_at"] is not None
                is_paused = row["pause_requested_at"] is not None

            state = {
                "is_cancelled": is_cancelled,
                "is_paused": is_paused
            }
            
            cls._cache[job_id] = {
                "state": state,
                "expires_at": now + cls._cache_ttl_sec
            }
            return state
        except Exception as e:
            logger.warning("Failed to check lifecycle state via asyncpg, using default", error=str(e), job_id=job_id)
            return {"is_cancelled": False, "is_paused": False}

    @classmethod
    def check_lifecycle(cls, job_id: str) -> dict:
        """Sync fallback for legacy callers."""
        now = time.time()
        cached = cls._cache.get(job_id)
        if cached and cached["expires_at"] > now:
            return cached["state"]
        return {"is_cancelled": False, "is_paused": False}

    @classmethod
    async def throw_if_cancelled_async(cls, job_id: str):
        if not job_id:
            return
            
        state = await cls.check_lifecycle_async(job_id)
        if state["is_cancelled"]:
            logger.info("Cancellation requested by operator.", job_id=job_id)
            raise CancellationError(f"Job {job_id} cancelled by operator.")
            
        if state["is_paused"]:
            logger.info("Pause requested by operator.", job_id=job_id)
            raise PauseError(f"Job {job_id} paused by operator.")

    @classmethod
    def throw_if_cancelled(cls, job_id: str):
        """Sync fallback."""
        if not job_id:
            return
        state = cls.check_lifecycle(job_id)
        if state["is_cancelled"]:
            raise CancellationError(f"Job {job_id} cancelled by operator.")
        if state["is_paused"]:
            raise PauseError(f"Job {job_id} paused by operator.")
