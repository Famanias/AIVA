"""
OpenAICompatibleProvider — speaks the OpenAI Chat Completions protocol to ANY
OpenAI-compatible endpoint (OpenRouter, Groq, OmniRoute, Ollama/v1, OpenAI).
Implements ILLMProvider. All retry/fence-stripping/json-fallback logic lives here.
"""
import json
import re
from typing import Any, AsyncGenerator, Callable

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.llm.base import ILLMProvider, LLMProviderError, ModelInfo

logger = structlog.get_logger(__name__)

_RETRY_POLICY = dict(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class OpenAICompatibleProvider(ILLMProvider):
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client_factory: Callable[..., Any] | None = None,
    ) -> None:
        from openai import AsyncOpenAI

        factory = client_factory or AsyncOpenAI
        self._client = factory(base_url=base_url.rstrip("/"), api_key=api_key)
        self._model = model
        self._base_url = base_url.rstrip("/")

    @retry(**_RETRY_POLICY)
    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: Any = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}] if system_prompt else []
        messages.append({"role": "user", "content": prompt})
        try:
            resp = await self._client.chat.completions.create(
                model=self._model, messages=messages
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error("oai_generate_text_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_text failed: {e}", e)

    @retry(**_RETRY_POLICY)
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        json_schema: dict[str, Any],
        context: Any = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> Any:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or ""
            return self._parse_json(raw)
        except json.JSONDecodeError:
            logger.warning("oai_json_object_failed", retrying=True)
            try:
                reinforced = (
                    system_prompt
                    + "\n\nRespond with ONLY valid JSON. No prose, no code fences."
                )
                resp = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": reinforced},
                        {"role": "user", "content": prompt},
                    ],
                )
                return self._parse_json(resp.choices[0].message.content or "")
            except json.JSONDecodeError as e:
                raise LLMProviderError(
                    "openai_compatible", f"Response was not valid JSON: {e}", e
                )
        except Exception as e:
            logger.error("oai_generate_json_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_json failed: {e}", e)

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: Any = None,
    ) -> AsyncGenerator[str, None]:
        messages = [{"role": "system", "content": system_prompt}] if system_prompt else []
        messages.append({"role": "user", "content": prompt})
        try:
            stream = await self._client.chat.completions.create(
                model=self._model, messages=messages, stream=True
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
        except Exception as e:
            logger.error("oai_generate_stream_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_stream failed: {e}", e)

    async def list_models(self) -> list[ModelInfo]:
        try:
            resp = await self._client.models.list()
            return [
                ModelInfo(id=m.id, owned_by=getattr(m, "owned_by", None))
                for m in resp.data
            ]
        except Exception as e:
            logger.debug("oai_models_list_unsupported", error=str(e))
            return [ModelInfo(id=self._model, owned_by="unknown")]

    @staticmethod
    def _parse_json(raw: str) -> Any:
        cleaned = _FENCE_RE.sub("", raw.strip())
        return json.loads(cleaned)
