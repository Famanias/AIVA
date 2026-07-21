"""
Outline Agent

Transforms research into a structured video outline appropriate for the video style.
Called during the 'outline' job_step.
Generation parameters (duration, pacing, platform) come from the GenerationProfile,
not from hardcoded defaults.
See EDD §16.1.
"""
from dataclasses import dataclass
from typing import Any

import structlog

from app.providers.llm.base import ILLMProvider

logger = structlog.get_logger(__name__)

OUTLINE_SCHEMA = {
    "type": "object",
    "required": ["title", "hook", "points", "conclusion"],
    "properties": {
        "title": {"type": "string"},
        "hook": {"type": "string"},
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["index", "heading", "keyPoints"],
                "properties": {
                    "index": {"type": "integer"},
                    "heading": {"type": "string"},
                    "keyPoints": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "conclusion": {"type": "string"},
    },
}


@dataclass
class OutlinePoint:
    index: int
    heading: str
    key_points: list[str]


@dataclass
class OutlineOutput:
    title: str
    hook: str
    points: list[OutlinePoint]
    conclusion: str


class OutlineAgent:
    """
    Produces a structured video outline from the research summary.

    The outline is style-aware:
    - documentary → chronological / causal structure
    - stickman_animation → scene/beat structure
    """

    def __init__(self, llm: ILLMProvider) -> None:
        self._llm = llm

    async def run(
        self,
        topic: str,
        video_style: str,
        research_summary: str,
        language: str = "en",
        generation_profile: dict[str, Any] | None = None,
        # Legacy fallback only — prefer generation_profile
        duration_target_minutes: int = 1,
    ) -> OutlineOutput:
        logger.info("outline_agent_start", topic=topic, video_style=video_style)

        from app.prompts import build_outline_prompt

        prompt = build_outline_prompt(
            topic=topic,
            video_style=video_style,
            language=language,
            research_summary=research_summary,
            generation_profile=generation_profile,
            duration_target_minutes=duration_target_minutes,
        )

        raw = await self._llm.generate_json(
            prompt=prompt.user_prompt,
            system_prompt=prompt.system_prompt,
            json_schema=OUTLINE_SCHEMA,
        )

        points = [
            OutlinePoint(
                index=p["index"],
                heading=p["heading"],
                key_points=p["keyPoints"],
            )
            for p in raw.get("points", [])
        ]

        result = OutlineOutput(
            title=raw["title"],
            hook=raw["hook"],
            points=points,
            conclusion=raw["conclusion"],
        )

        logger.info("outline_agent_complete", title=result.title, points=len(result.points))
        return result
