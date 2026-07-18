from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()

@router.get("/jobs/{job_id}/summary")
async def get_job_summary(job_id: str) -> Dict[str, Any]:
    """
    Returns aggregated metrics for a specific job, calculating
    totals on the backend so the frontend Dashboard remains dumb.
    """
    try:
        # In a real implementation, this queries the Supabase `cost_ledger_entries`
        # and `job_events` tables and aggregates the results.
        
        # MOCK IMPLEMENTATION FOR MVP
        summary = {
            "job_id": job_id,
            "total_tokens": 12500,
            "estimated_cost_usd": 0.04,
            "total_processing_time_ms": 145000,
            "queue_wait_time_ms": 500,
            "stages": [
                {"name": "research", "duration_ms": 15000},
                {"name": "script_direction", "duration_ms": 35000},
                {"name": "voiceover", "duration_ms": 25000},
                {"name": "subtitle_extraction", "duration_ms": 10000},
                {"name": "assets", "duration_ms": 20000},
                {"name": "rendering", "duration_ms": 15000},
                {"name": "composition", "duration_ms": 25000},
            ]
        }
        
        return {
            "status": "success",
            "data": summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
