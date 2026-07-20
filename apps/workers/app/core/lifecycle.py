import time
import structlog
from supabase import create_client, Client
from app.core.config import settings

logger = structlog.get_logger(__name__)

class CancellationError(Exception):
    pass

class PauseError(Exception):
    pass

class LifecycleService:
    _cache = {}
    _cache_ttl_sec = 2.0

    @classmethod
    def get_supabase(cls) -> Client:
        return create_client(
            settings.supabase_url,
            settings.supabase_service_role_key
        )

    @classmethod
    def check_lifecycle(cls, job_id: str) -> dict:
        now = time.time()
        cached = cls._cache.get(job_id)

        if cached and cached["expires_at"] > now:
            return cached["state"]

        try:
            supabase = cls.get_supabase()
            response = supabase.table("jobs").select("cancel_requested_at, pause_requested_at").eq("id", job_id).execute()
            data = response.data
            
            is_cancelled = False
            is_paused = False
            
            if data and len(data) > 0:
                is_cancelled = data[0].get("cancel_requested_at") is not None
                is_paused = data[0].get("pause_requested_at") is not None

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
            logger.error("Failed to check lifecycle state", error=str(e), job_id=job_id)
            return {"is_cancelled": False, "is_paused": False} # Fail open

    @classmethod
    def should_pause(cls, job_id: str) -> bool:
        if not job_id:
            return False
        state = cls.check_lifecycle(job_id)
        return state["is_paused"]

    @classmethod
    def throw_if_cancelled(cls, job_id: str):
        if not job_id:
            return
            
        state = cls.check_lifecycle(job_id)
        if state["is_cancelled"]:
            logger.info("Cancellation requested by operator.", job_id=job_id)
            raise CancellationError(f"Job {job_id} cancelled by operator.")
            
        if state["is_paused"]:
            logger.info("Pause requested by operator.", job_id=job_id)
            raise PauseError(f"Job {job_id} paused by operator.")
