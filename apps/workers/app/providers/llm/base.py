"""
ILLMProvider — Abstract base class for all LLM providers.

Business logic must never import provider SDKs directly.
All LLM access goes through this interface.
See RULES Rule 5 — Abstract External Providers.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncGenerator


@dataclass
class ModelInfo:
    id: str
    owned_by: str | None = None
    context_window: int | None = None


class ILLMProvider(ABC):
    """Abstract LLM provider interface."""

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: Any = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> str:
        """
        Generate free-form text from a prompt.

        Args:
            prompt: The user message/instruction.
            system_prompt: Optional system-level instruction.

        Returns:
            Generated text string.

        Raises:
            LLMProviderError: If the provider fails after retries.
        """
        ...

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        json_schema: dict[str, Any],
        context: Any = None,
        prompt_id: str | None = None,
        prompt_version: str | None = None,
    ) -> Any:
        """
        Generate structured JSON output conforming to the given schema.

        Args:
            prompt: The user message/instruction.
            system_prompt: System-level instruction (usually enforces JSON format).
            json_schema: JSON Schema dict describing the expected output structure.

        Returns:
            Parsed Python object matching the schema.

        Raises:
            LLMProviderError: If the provider fails or returns invalid JSON.
        """
        ...

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: Any = None,
    ) -> AsyncGenerator[str, None]:
        """
        Generate streaming text deltas from a prompt.

        Args:
            prompt: The user message/instruction.
            system_prompt: Optional system-level instruction.
            context: Optional telemetry context.

        Yields:
            Text chunks (str) as they arrive.
        """
        ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """
        List available models for this provider/endpoint.

        Returns:
            List of ModelInfo objects.
        """
        ...


class LLMProviderError(Exception):
    """Raised when an LLM provider fails to produce a valid response."""

    def __init__(self, provider: str, message: str, cause: Exception | None = None):
        self.provider = provider
        self.cause = cause
        super().__init__(f"[{provider}] {message}")
