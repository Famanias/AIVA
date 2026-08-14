from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.models.composition import CompositionModel
from app.core.composition.engine import CompositionEngine
from app.core.lifecycle import LifecycleService

router = APIRouter()

@router.post("/composite")
async def composite_video(model: CompositionModel) -> Dict[str, Any]:
    """
    Executes the FFmpeg Media Composition Engine.
    """
    await LifecycleService.throw_if_cancelled_async(model.job_id or model.trace_id)
    try:
        # In a full deployment, progress events could be written to a database
        # or pushed to a Redis pub/sub queue for the Dashboard to consume via WebSockets.
        def emit_progress(msg: str, pct: int):
            pass # Progress emitter can send to WebSockets/Redis when connected
            
        result = CompositionEngine.run(model, emit_progress=emit_progress)
        
        return {
            "status": "success",
            "data": result.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
