# pyrefly: ignore [missing-import]
from typing import Any
import structlog

from app.providers.factory import (
    get_llm_provider_async,
    get_search_provider_async,
    get_tts_provider_async,
)
from app.agents.research_agent import ResearchAgent, ResearchOutput
from app.agents.outline_agent import OutlineAgent, OutlineOutput
from app.agents.script_director_agent import ScriptDirectorAgent, ScriptDirectorOutput
from app.agents.voiceover_agent import VoiceoverAgent, VoiceoverOutput
from app.agents.subtitle_agent import SubtitleAgent, SubtitleOutput
from app.models.whisper import WhisperModelWrapper
from app.core.lifecycle import LifecycleService, CancellationError, PauseError

from app.repositories.artifact_repository import ArtifactRepository

logger = structlog.get_logger(__name__)
artifact_repo = ArtifactRepository()


async def handle_research_stage(job_id: str, topic: str, language: str = "en") -> dict:
    """Executes the Research Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    llm = await get_llm_provider_async()
    search = await get_search_provider_async()
    agent = ResearchAgent(llm, search)

    output: ResearchOutput = await agent.run(topic, language)
    
    result = {
        "researchSources": [
            {"title": s.title, "url": s.url, "excerpt": s.excerpt}
            for s in output.sources
        ],
        "researchSummary": output.summary,
    }
    
    try:
        artifact_repo.save_stage_artifact(job_id, "01_research", result)
    except Exception as e:
        logger.warning("failed_to_persist_research_artifact", error=str(e))

    return result


async def handle_outline_stage(
    job_id: str,
    topic: str,
    video_style: str,
    research_summary: str,
    language: str = "en",
    generation_profile: dict[str, Any] | None = None,
    # Legacy fallback only
    duration_target_minutes: int = 1,
) -> dict:
    """Executes the Outline Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    llm = await get_llm_provider_async()
    agent = OutlineAgent(llm)

    output: OutlineOutput = await agent.run(
        topic=topic,
        video_style=video_style,
        research_summary=research_summary,
        language=language,
        generation_profile=generation_profile,
        duration_target_minutes=duration_target_minutes,
    )

    result = {
        "outline": [
            {
                "index": p.index,
                "heading": p.heading,
                "keyPoints": p.key_points,
            }
            for p in output.points
        ]
    }

    try:
        artifact_repo.save_stage_artifact(job_id, "02_outline", result)
    except Exception as e:
        logger.warning("failed_to_persist_outline_artifact", error=str(e))

    return result


async def handle_script_direction_stage(
    job_id: str,
    topic: str,
    video_style: str,
    outline: list[dict] | None = None,
    visual_type_weights: dict[str, float] | None = None,
    allowed_templates: list[str] | None = None,
    default_camera_pacing: str = "fast",
    rig_action_list: list[str] | None = None,
    typography_template_list: list[str] | None = None,
    language: str = "en",
    generation_profile: dict[str, Any] | None = None,
    custom_script: str | None = None,
    # Legacy fallback only
    duration_target_minutes: int = 1,
) -> dict:
    """Executes the combined Script + Director Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    llm = await get_llm_provider_async()
    agent = ScriptDirectorAgent(llm)

    if custom_script and custom_script.strip():
        outline_text = f"USER CUSTOM SCRIPT (Break down this exact text into sequential visual scenes):\n{custom_script.strip()}"
    elif outline:
        outline_text = "\n".join(
            f"{p.get('index', i+1)}. {p.get('heading', 'Section')}\n" + "\n".join(f"  - {kp}" for kp in p.get('keyPoints', []))
            for i, p in enumerate(outline)
        )
    else:
        outline_text = f"TOPIC: {topic}"

    output: ScriptDirectorOutput = await agent.run(
        topic=topic,
        video_style=video_style,
        outline=outline_text,
        visual_type_weights=visual_type_weights or {},
        allowed_templates=allowed_templates or [],
        default_camera_pacing=default_camera_pacing,
        rig_action_list=rig_action_list or [],
        typography_template_list=typography_template_list or [],
        language=language,
        generation_profile=generation_profile,
        duration_target_minutes=duration_target_minutes,
    )

    result = {
        "sceneDirections": [
            {
                "sequence_number": s.sequence_number,
                "scriptSegment": s.script_segment,
                "visualType": s.visual_type,
                "animationAction": s.animation_action,
                "cameraStyle": s.camera_style,
                "typographyTemplate": s.typography_template,
                "transition": s.transition,
                "emotionalTone": s.emotional_tone,
                "brollSearchKeywords": s.broll_search_keywords,
                "visualPrompt": s.visual_prompt,
            }
            for s in output.scenes
        ]
    }

    try:
        artifact_repo.save_stage_artifact(job_id, "03_script", result)
    except Exception as e:
        logger.warning("failed_to_persist_script_artifact", error=str(e))

    return result


async def handle_voiceover_stage(
    job_id: str,
    scenes: list[dict],
    voice_id: str = "en-US-AriaNeural",
) -> dict:
    """Executes the Voiceover Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    tts = await get_tts_provider_async()
    agent = VoiceoverAgent(tts)
    agent = VoiceoverAgent(tts)
    
    outputs: list[VoiceoverOutput] = await agent.run(scenes, voice_id)
    
    result = {
        "voiceovers": [
            {
                "sequence_number": o.scene_number,
                "audio_url": o.audio_url,
                "word_timings": o.word_timings,
                "duration_sec": o.duration_sec,
            }
            for o in outputs
        ]
    }

    try:
        artifact_repo.save_stage_artifact(job_id, "04_voice", result)
    except Exception as e:
        logger.warning("failed_to_persist_voice_artifact", error=str(e))

    return result


async def handle_subtitle_extraction_stage(
    job_id: str,
    scene_voiceovers: list[dict],
) -> dict:
    """Executes the Subtitle Extraction Agent. (Stubbed for MVP)"""
    LifecycleService.throw_if_cancelled(job_id)
    logger.info("subtitle_extraction_stub", num_scenes=len(scene_voiceovers))
    
    result = {
        "subtitles": [
            {
                "sequence_number": sv.get("sequence_number", i),
                "word_timings": [],
            }
            for i, sv in enumerate(scene_voiceovers)
        ]
    }

    try:
        artifact_repo.save_stage_artifact(job_id, "05_subtitles", result)
    except Exception as e:
        logger.warning("failed_to_persist_subtitle_artifact", error=str(e))

    return result
