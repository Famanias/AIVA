"""
Gemini LLM Provider implementation.

Uses Google's generativeai SDK under the hood.
The rest of the codebase only depends on ILLMProvider — never on this class directly.
"""
import json
import re
from typing import Any

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.llm.base import ILLMProvider, LLMProviderError
from app.core.telemetry import TelemetryClient, ProviderUsageCollector
from app.models.telemetry import TelemetryContext

logger = structlog.get_logger(__name__)

_RETRY_POLICY = dict(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(Exception),
    reraise=False,
)


class GeminiProvider(ILLMProvider):
    """
    Google Gemini LLM provider.

    Supports generate_text and generate_json using the gemini-1.5-flash model
    (or any model configured via GEMINI_MODEL).
    """

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash") -> None:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self._model_name = model
            self._genai = genai
        except ImportError as e:
            raise LLMProviderError("gemini", "google-generativeai package not installed", e)

    @retry(**_RETRY_POLICY)
    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: TelemetryContext | None = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> str:
        try:
            model = self._genai.GenerativeModel(
                model_name=self._model_name,
                system_instruction=system_prompt,
            )
            logger.debug("gemini_generate_text", model=self._model_name, prompt_chars=len(prompt))
            
            # Use Telemetry if provided
            if context:
                with TelemetryClient.track_span("gemini_generate_text", context, {"model": self._model_name}) as span:
                    response = model.generate_content(prompt)
                    
                    # Extract usage metadata
                    if hasattr(response, "usage_metadata"):
                        usage = {
                            "promptTokenCount": getattr(response.usage_metadata, "prompt_token_count", 0),
                            "candidatesTokenCount": getattr(response.usage_metadata, "candidates_token_count", 0),
                            "totalTokenCount": getattr(response.usage_metadata, "total_token_count", 0),
                        }
                        span.attributes["usage"] = usage
                        
                        # Record provider usage
                        ProviderUsageCollector.extract_and_record_llm(
                            job_id=context.job_id,
                            project_id=context.project_id or "",
                            provider="gemini",
                            model=self._model_name,
                            raw_usage=usage,
                            prompt_id=prompt_id,
                            prompt_version=prompt_version
                        )
            else:
                response = model.generate_content(prompt)
                
            return response.text
        except Exception as e:
            logger.error("gemini_generate_text_failed", error=str(e))
            raise LLMProviderError("gemini", f"generate_text failed: {e}", e)

    @retry(**_RETRY_POLICY)
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        json_schema: dict[str, Any],
        context: TelemetryContext | None = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> Any:
        try:
            model = self._genai.GenerativeModel(
                model_name=self._model_name,
                system_instruction=system_prompt,
                generation_config=self._genai.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )
            logger.debug("gemini_generate_json", model=self._model_name)
            
            if context:
                with TelemetryClient.track_span("gemini_generate_json", context, {"model": self._model_name}) as span:
                    response = model.generate_content(prompt)
                    
                    if hasattr(response, "usage_metadata"):
                        usage = {
                            "promptTokenCount": getattr(response.usage_metadata, "prompt_token_count", 0),
                            "candidatesTokenCount": getattr(response.usage_metadata, "candidates_token_count", 0),
                        }
                        span.attributes["usage"] = usage
                        ProviderUsageCollector.extract_and_record_llm(
                            job_id=context.job_id,
                            project_id=context.project_id or "",
                            provider="gemini",
                            model=self._model_name,
                            raw_usage=usage,
                            prompt_id=prompt_id,
                            prompt_version=prompt_version
                        )
            else:
                response = model.generate_content(prompt)
                
            raw = response.text

            # Strip any accidental markdown code fences
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)

            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("gemini_generate_json_parse_failed", error=str(e))
            raise LLMProviderError("gemini", f"Response was not valid JSON: {e}", e)
        except Exception as e:
            logger.error("gemini_generate_json_failed", error=str(e))
            raise LLMProviderError("gemini", f"generate_json failed: {e}", e)
