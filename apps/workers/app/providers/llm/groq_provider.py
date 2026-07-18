"""
Groq LLM Provider implementation.
"""
import json
import re
from typing import Any
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.llm.base import ILLMProvider, LLMProviderError

logger = structlog.get_logger(__name__)

_RETRY_POLICY = dict(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(Exception),
    reraise=False,
)

class GroqProvider(ILLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile") -> None:
        try:
            from groq import AsyncGroq
            self._client = AsyncGroq(api_key=api_key)
            self._model_name = model
        except ImportError as e:
            raise LLMProviderError("groq", "groq package not installed", e)

    @retry(**_RETRY_POLICY)
    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            logger.debug("groq_generate_text", model=self._model_name)
            response = await self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error("groq_generate_text_failed", error=str(e))
            raise LLMProviderError("groq", f"generate_text failed: {e}", e)

    @retry(**_RETRY_POLICY)
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        json_schema: dict[str, Any],
    ) -> Any:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        try:
            logger.debug("groq_generate_json", model=self._model_name)
            response = await self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or ""
            
            # Strip markdown fences just in case
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)

            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise LLMProviderError("groq", f"Response was not valid JSON: {e}", e)
        except Exception as e:
            raise LLMProviderError("groq", f"generate_json failed: {e}", e)
