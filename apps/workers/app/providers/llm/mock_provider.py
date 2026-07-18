import json
from typing import Any
import structlog

from app.providers.llm.base import ILLMProvider
from app.models.telemetry import TelemetryContext

logger = structlog.get_logger(__name__)

class MockLLMProvider(ILLMProvider):
    """
    Deterministic Mock LLM Provider for CI/CD and Golden Suite Certification.
    Returns hardcoded responses based on the system prompt or prompt_id.
    Never makes network requests.
    """

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: TelemetryContext | None = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> str:
        logger.info("mock_llm_generate_text", prompt_id=prompt_id)
        return "This is a deterministic mock text response for CI."

    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        json_schema: dict[str, Any],
        context: TelemetryContext | None = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> Any:
        logger.info("mock_llm_generate_json", prompt_id=prompt_id)
        
        # In a real scenario, this would load from `tests/golden/v1/mocks/`
        # For MVP, we return a valid matching schema structure for the core agent chain
        
        # Check if it's the Research Agent
        if "outline" in json_schema.get("properties", {}):
            return {
                "outline": [
                    {"section_title": "Introduction", "key_points": ["Mock point 1"]},
                    {"section_title": "Body", "key_points": ["Mock point 2"]},
                ]
            }
            
        # Check if it's the Script/Director Agent
        if "scenes" in json_schema.get("properties", {}):
            return {
                "scenes": [
                    {
                        "narrative_text": "Welcome to the mock Roman Empire.",
                        "visual_type": "stock",
                        "action": "Pan across a map of Rome.",
                        "transition": "fade"
                    }
                ]
            }
            
        # Fallback empty object
        return {}
