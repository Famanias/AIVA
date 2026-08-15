"""
Script + Director Agent

Writes the full narrative script AND tags every scene's visual direction
in a single combined LLM call.
Generation parameters (duration, pacing, platform) come from the GenerationProfile.
Called during the 'script_direction' job_step.
See EDD §16.1.
"""
import json
from dataclasses import dataclass
from typing import Any

import structlog

from app.providers.llm.base import ILLMProvider
from app.providers.llm.base import LLMProviderError

logger = structlog.get_logger(__name__)

# The schema matches the expected output from the prompt
SCRIPT_DIRECTOR_SCHEMA = {
    "type": "object",
    "required": ["title", "scenes"],
    "properties": {
        "title": {"type": "string"},
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "sequence_number",
                    "script_segment",
                    "visual_type",
                    "transition",
                    "emotional_tone",
                ],
                "properties": {
                    "sequence_number": {"type": "integer"},
                    "script_segment": {"type": "string"},
                    "visual_type": {"type": "string"},
                    "animation_action": {"type": ["string", "null"]},
                    "camera_style": {"type": ["string", "null"]},
                    "typography_template": {"type": ["string", "null"]},
                    "background_broll_url": {"type": ["string", "null"]},
                    "transition": {"type": "string"},
                    "emotional_tone": {"type": "string"},
                    "broll_search_keywords": {"type": ["string", "null"]},
                    "visual_prompt": {"type": ["string", "null"]},
                },
            },
        },
    },
}

@dataclass
class SceneDirection:
    sequence_number: int
    script_segment: str
    visual_type: str
    animation_action: str | None
    camera_style: str | None
    typography_template: str | None
    background_broll_url: str | None
    transition: str
    emotional_tone: str
    broll_search_keywords: str | None
    visual_prompt: str | None

@dataclass
class ScriptDirectorOutput:
    title: str
    scenes: list[SceneDirection]

class ScriptDirectorAgent:
    """
    Produces the fully directed script in one pass.
    """

    def __init__(self, llm: ILLMProvider) -> None:
        self._llm = llm

    async def run(
        self,
        topic: str,
        video_style: str,
        outline: str, # JSON string or structured text of the outline
        visual_type_weights: dict[str, float],
        allowed_templates: list[str],
        default_camera_pacing: str,
        rig_action_list: list[str],
        typography_template_list: list[str],
        language: str = "en",
        generation_profile: dict[str, Any] | None = None,
        # Legacy fallback only — prefer generation_profile
        duration_target_minutes: int = 1,
    ) -> ScriptDirectorOutput:
        logger.info("script_director_agent_start", topic=topic, video_style=video_style)

        from app.prompts import build_script_director_prompt

        prompt = build_script_director_prompt(
            topic=topic,
            language=language,
            video_style=video_style,
            visual_type_weights=visual_type_weights,
            allowed_templates=allowed_templates,
            default_camera_pacing=default_camera_pacing,
            rig_action_list=rig_action_list,
            typography_template_list=typography_template_list,
            outline=outline,
            generation_profile=generation_profile,
            duration_target_minutes=duration_target_minutes,
        )

        try:
            raw = await self._llm.generate_json(
                prompt=prompt.user_prompt,
                system_prompt=prompt.system_prompt,
                json_schema=SCRIPT_DIRECTOR_SCHEMA,
            )
        except LLMProviderError as e:
            logger.error("script_director_failed", error=str(e))
            raise

        scenes = [
            SceneDirection(
                sequence_number=s.get("sequence_number", idx + 1),
                script_segment=s.get("script_segment") or s.get("scriptSegment") or s.get("text", ""),
                visual_type=s.get("visual_type") or s.get("visualType") or "broll",
                animation_action=s.get("animation_action") or s.get("animationAction"),
                camera_style=s.get("camera_style") or s.get("cameraStyle") or "zoom_in_slow",
                typography_template=s.get("typography_template") or s.get("typographyTemplate"),
                background_broll_url=s.get("background_broll_url"),
                transition=s.get("transition", "cut"),
                emotional_tone=s.get("emotional_tone") or s.get("emotionalTone", "neutral"),
                broll_search_keywords=s.get("broll_search_keywords") or s.get("brollSearchKeywords"),
                visual_prompt=s.get("visual_prompt") or s.get("visualPrompt"),
            )
            for idx, s in enumerate(raw.get("scenes", []))
        ]

        result = ScriptDirectorOutput(
            title=raw.get("title", topic),
            scenes=scenes,
        )


        logger.info("script_director_agent_complete", title=result.title, num_scenes=len(result.scenes))
        return result
