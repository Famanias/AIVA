# pyrefly: ignore [missing-import]
import os
import shutil
import subprocess
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
    await LifecycleService.throw_if_cancelled_async(job_id)
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
    await LifecycleService.throw_if_cancelled_async(job_id)
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
    await LifecycleService.throw_if_cancelled_async(job_id)
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

    # Derive duration target if present in generation_profile
    if generation_profile:
        target_sec = generation_profile.get("duration_target_seconds") or generation_profile.get("target_duration_seconds")
        if target_sec:
            duration_target_minutes = max(1, round(float(target_sec) / 60.0))

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
    project_id: str | None = None,
) -> dict:
    """Executes the Voiceover Agent and stitches the master voice track."""
    await LifecycleService.throw_if_cancelled_async(job_id)
    tts = await get_tts_provider_async()
    agent = VoiceoverAgent(tts)
    
    outputs: list[VoiceoverOutput] = await agent.run(scenes, voice_id)
    
    master_audio_url = None
    if outputs:
        from app.core.storage import get_project_storage_dir
        from app.core.audio_utils import concat_audio_files
        valid_project_id = project_id or job_id
        project_storage_dir = get_project_storage_dir(valid_project_id)
        master_voice_file = os.path.join(project_storage_dir, "master_voice.mp3")

        master_duration_sec = 0.0
        try:
            audio_files = [o.audio_url for o in outputs if o.audio_url]
            master_audio_url = concat_audio_files(audio_files, master_voice_file)
            from app.core.audio_utils import get_audio_duration
            master_duration_sec = get_audio_duration(master_audio_url)
            if master_duration_sec <= 0.0:
                master_duration_sec = sum(float(o.duration_sec or 0.0) for o in outputs)
            logger.info("master_voice_concatenated", master_path=master_audio_url, duration=master_duration_sec, scenes_count=len(outputs))
        except Exception as e:
            logger.warning("failed_to_concatenate_master_voice", error=str(e))
            master_audio_url = outputs[0].audio_url
            master_duration_sec = sum(float(o.duration_sec or 0.0) for o in outputs)

    result = {
        "master_audio_url": master_audio_url,
        "master_duration_sec": round(master_duration_sec, 3),
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
    """Executes the Subtitle Extraction Agent."""
    await LifecycleService.throw_if_cancelled_async(job_id)
    logger.info("subtitle_extraction_stage", num_scenes=len(scene_voiceovers))
    
    subtitles = []
    current_time_offset = 0.0
    global_word_timings = []

    for i, sv in enumerate(scene_voiceovers):
        seq = sv.get("sequence_number", i + 1)
        raw_timings = sv.get("word_timings", [])
        duration = float(sv.get("duration_sec", 0.0) or sv.get("duration", 0.0) or 0.0)
        
        # Calculate cumulative offset timings for the global timeline
        scene_timings = []
        for wt in raw_timings:
            start = float(wt.get("start", 0.0))
            end = float(wt.get("end", 0.0))
            word = wt.get("word", "")
            scene_timings.append({
                "word": word,
                "start": round(start, 3),
                "end": round(end, 3),
            })
            global_word_timings.append({
                "word": word,
                "start": round(start + current_time_offset, 3),
                "end": round(end + current_time_offset, 3),
            })
        
        if not scene_timings and sv.get("text"):
            words = str(sv.get("text")).split()
            if words and duration > 0:
                t_step = duration / len(words)
                for w_idx, w in enumerate(words):
                    w_start = round(w_idx * t_step, 3)
                    w_end = round((w_idx + 1) * t_step, 3)
                    scene_timings.append({"word": w, "start": w_start, "end": w_end})
                    global_word_timings.append({"word": w, "start": round(w_start + current_time_offset, 3), "end": round(w_end + current_time_offset, 3)})

        subtitles.append({
            "sequence_number": seq,
            "word_timings": scene_timings,
            "duration": duration,
        })
        current_time_offset += duration

    result = {
        "subtitles": subtitles,
        "global_word_timings": global_word_timings,
    }

    try:
        artifact_repo.save_stage_artifact(job_id, "05_subtitles", result)
    except Exception as e:
        logger.warning("failed_to_persist_subtitle_artifact", error=str(e))

    return result
