import json
import re
from typing import Any
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.llm.base import ILLMProvider, LLMProviderError
from app.models.telemetry import TelemetryContext

logger = structlog.get_logger(__name__)

_RETRY_POLICY = dict(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=False,
)


class OllamaProvider(ILLMProvider):
    """
    Local Ollama LLM provider for 100% offline inference.
    Connects to local Ollama HTTP endpoint (default: http://localhost:11434).
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2",
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model_name = model

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
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            payload = {
                "model": self._model_name,
                "prompt": full_prompt,
                "stream": False,
            }
            logger.debug("ollama_generate_text", model=self._model_name, base_url=self._base_url)

            async with httpx.AsyncClient(timeout=120.0) as client:
                res = await client.post(f"{self._base_url}/api/generate", json=payload)
                res.raise_for_status()
                data = res.json()
                return data.get("response", "")
        except Exception as e:
            logger.error("ollama_generate_text_failed", error=str(e))
            raise LLMProviderError("ollama", f"generate_text failed: {e}", e)

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
            full_prompt = f"{system_prompt}\n\nPlease respond strictly with valid JSON conforming to the requested schema.\n\n{prompt}"
            payload = {
                "model": self._model_name,
                "prompt": full_prompt,
                "format": "json",
                "stream": False,
            }
            logger.debug("ollama_generate_json", model=self._model_name)

            async with httpx.AsyncClient(timeout=180.0) as client:
                res = await client.post(f"{self._base_url}/api/generate", json=payload)
                res.raise_for_status()
                data = res.json()
                raw = data.get("response", "")

            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)

            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("ollama_generate_json_parse_failed", error=str(e))
            raise LLMProviderError("ollama", f"Response was not valid JSON: {e}", e)
        except Exception as e:
            logger.error("ollama_generate_json_failed", error=str(e))
            raise LLMProviderError("ollama", f"generate_json failed: {e}", e)
