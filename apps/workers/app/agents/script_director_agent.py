"""
Script + Director Agent

Writes the full narrative script AND tags every scene's visual direction
in a single combined LLM call.
Called during the 'script_direction' job_step.
See EDD §16.1.
"""
import json
from dataclasses import dataclass

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
        duration_target_minutes: int = 20,
        language: str = "en",
    ) -> ScriptDirectorOutput:
        logger.info("script_director_agent_start", topic=topic, video_style=video_style)

        # Average speaking rate is ~150 words per minute
        approx_word_count = duration_target_minutes * 150

        from app.prompts import build_script_director_prompt

        prompt = build_script_director_prompt(
            topic=topic,
            language=language,
            video_style=video_style,
            visual_type_weights=visual_type_weights,
            allowed_templates=allowed_templates,
            default_camera_pacing=default_camera_pacing,
            duration_target_minutes=duration_target_minutes,
            approx_word_count=approx_word_count,
            rig_action_list=rig_action_list,
            typography_template_list=typography_template_list,
            outline=outline,
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
                sequence_number=s["sequence_number"],
                script_segment=s["script_segment"],
                visual_type=s["visual_type"],
                animation_action=s.get("animation_action"),
                camera_style=s.get("camera_style"),
                typography_template=s.get("typography_template"),
                background_broll_url=s.get("background_broll_url"),
                transition=s["transition"],
                emotional_tone=s["emotional_tone"],
                broll_search_keywords=s.get("broll_search_keywords"),
                visual_prompt=s.get("visual_prompt"),
            )
            for s in raw.get("scenes", [])
        ]

        result = ScriptDirectorOutput(
            title=raw["title"],
            scenes=scenes,
        )

        logger.info("script_director_agent_complete", title=result.title, num_scenes=len(result.scenes))
        return result
