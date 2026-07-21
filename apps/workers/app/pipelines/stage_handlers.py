# pyrefly: ignore [missing-import]
from typing import Any
import structlog

from app.providers.factory import get_llm_provider, get_search_provider, get_tts_provider
from app.agents.research_agent import ResearchAgent, ResearchOutput
from app.agents.outline_agent import OutlineAgent, OutlineOutput
from app.agents.script_director_agent import ScriptDirectorAgent, ScriptDirectorOutput
from app.agents.voiceover_agent import VoiceoverAgent, VoiceoverOutput
from app.agents.subtitle_agent import SubtitleAgent, SubtitleOutput
from app.models.whisper import WhisperModelWrapper
from app.core.lifecycle import LifecycleService, CancellationError, PauseError

logger = structlog.get_logger(__name__)


async def handle_research_stage(job_id: str, topic: str, language: str = "en") -> dict:
    """Executes the Research Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    llm = get_llm_provider()
    search = get_search_provider()
    agent = ResearchAgent(llm, search)

    output: ResearchOutput = await agent.run(topic, language)
    
    return {
        "researchSources": [
            {"title": s.title, "url": s.url, "excerpt": s.excerpt}
            for s in output.sources
        ],
        "researchSummary": output.summary,
    }


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
    llm = get_llm_provider()
    agent = OutlineAgent(llm)

    output: OutlineOutput = await agent.run(
        topic=topic,
        video_style=video_style,
        research_summary=research_summary,
        language=language,
        generation_profile=generation_profile,
        duration_target_minutes=duration_target_minutes,
    )

    return {
        "outline": [
            {
                "index": p.index,
                "heading": p.heading,
                "keyPoints": p.key_points,
            }
            for p in output.points
        ]
    }


async def handle_script_direction_stage(
    job_id: str,
    topic: str,
    video_style: str,
    outline: list[dict],
    visual_type_weights: dict[str, float],
    allowed_templates: list[str],
    default_camera_pacing: str,
    rig_action_list: list[str],
    typography_template_list: list[str],
    language: str = "en",
    generation_profile: dict[str, Any] | None = None,
    # Legacy fallback only
    duration_target_minutes: int = 1,
) -> dict:
    """Executes the combined Script + Director Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    llm = get_llm_provider()
    agent = ScriptDirectorAgent(llm)

    outline_text = "\n".join(
        f"{p['index']}. {p['heading']}\n" + "\n".join(f"  - {kp}" for kp in p['keyPoints'])
        for p in outline
    )

    output: ScriptDirectorOutput = await agent.run(
        topic=topic,
        video_style=video_style,
        outline=outline_text,
        visual_type_weights=visual_type_weights,
        allowed_templates=allowed_templates,
        default_camera_pacing=default_camera_pacing,
        rig_action_list=rig_action_list,
        typography_template_list=typography_template_list,
        language=language,
        generation_profile=generation_profile,
        duration_target_minutes=duration_target_minutes,
    )

    return {
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


async def handle_voiceover_stage(
    job_id: str,
    scenes: list[dict],
    voice_id: str = "en-US-AriaNeural",
) -> dict:
    """Executes the Voiceover Agent."""
    LifecycleService.throw_if_cancelled(job_id)
    tts = get_tts_provider()
    agent = VoiceoverAgent(tts)
    
    outputs: list[VoiceoverOutput] = await agent.run(scenes, voice_id)
    
    return {
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


async def handle_subtitle_extraction_stage(
    job_id: str,
    scene_voiceovers: list[dict],
) -> dict:
    """Executes the Subtitle Extraction Agent. (Stubbed for MVP)"""
    LifecycleService.throw_if_cancelled(job_id)
    logger.info("subtitle_extraction_stub", num_scenes=len(scene_voiceovers))
    
    # MVP stub: return empty word timings for each scene.
    # Full Whisper transcription will be enabled once the rendering pipeline is validated.
    return {
        "subtitles": [
            {
                "sequence_number": sv.get("sequence_number", i),
                "word_timings": [],
            }
            for i, sv in enumerate(scene_voiceovers)
        ]
    }
