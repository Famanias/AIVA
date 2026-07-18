"""
Pipeline Stage Endpoints

Called by the Node.js job dispatcher.
Payloads are passed via HTTP POST and validated with Pydantic.
"""
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.pipelines import stage_handlers
from app.core.logging import bind_trace_id, clear_trace_id

router = APIRouter()

# --- Request Models ---

class BaseStageRequest(BaseModel):
    trace_id: str
    project_id: str
    workspace_id: str

class ResearchStageRequest(BaseStageRequest):
    topic: str
    language: str = "en"

class OutlineStageRequest(BaseStageRequest):
    topic: str
    video_style: str
    research_summary: str
    duration_target_minutes: int
    language: str = "en"

class ScriptDirectionStageRequest(BaseStageRequest):
    topic: str
    video_style: str
    outline: list[dict]
    visual_type_weights: dict[str, float]
    allowed_templates: list[str]
    default_camera_pacing: str
    rig_action_list: list[str]
    typography_template_list: list[str]
    duration_target_minutes: int
    language: str = "en"

class VoiceoverStageRequest(BaseStageRequest):
    scenes: list[dict]
    voice_id: str = "en-US-AriaNeural"

class SubtitleStageRequest(BaseStageRequest):
    scene_voiceovers: list[dict]

# --- Endpoints ---

@router.post("/research")
async def run_research(req: ResearchStageRequest) -> dict[str, Any]:
    bind_trace_id(req.trace_id)
    try:
        result = await stage_handlers.handle_research_stage(
            topic=req.topic,
            language=req.language,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_trace_id()


@router.post("/outline")
async def run_outline(req: OutlineStageRequest) -> dict[str, Any]:
    bind_trace_id(req.trace_id)
    try:
        result = await stage_handlers.handle_outline_stage(
            topic=req.topic,
            video_style=req.video_style,
            research_summary=req.research_summary,
            duration_target_minutes=req.duration_target_minutes,
            language=req.language,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_trace_id()


@router.post("/script_direction")
async def run_script_direction(req: ScriptDirectionStageRequest) -> dict[str, Any]:
    bind_trace_id(req.trace_id)
    try:
        result = await stage_handlers.handle_script_direction_stage(
            topic=req.topic,
            video_style=req.video_style,
            outline=req.outline,
            visual_type_weights=req.visual_type_weights,
            allowed_templates=req.allowed_templates,
            default_camera_pacing=req.default_camera_pacing,
            rig_action_list=req.rig_action_list,
            typography_template_list=req.typography_template_list,
            duration_target_minutes=req.duration_target_minutes,
            language=req.language,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_trace_id()

@router.post("/voiceover")
async def run_voiceover(req: VoiceoverStageRequest) -> dict[str, Any]:
    bind_trace_id(req.trace_id)
    try:
        result = await stage_handlers.handle_voiceover_stage(
            scenes=req.scenes,
            voice_id=req.voice_id,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_trace_id()

@router.post("/subtitle_extraction")
async def run_subtitle_extraction(req: SubtitleStageRequest) -> dict[str, Any]:
    bind_trace_id(req.trace_id)
    try:
        result = await stage_handlers.handle_subtitle_extraction_stage(
            scene_voiceovers=req.scene_voiceovers,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_trace_id()
