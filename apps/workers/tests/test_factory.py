from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from app.providers.factory import get_llm_provider_async
from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider
from app.providers.llm.ollama_provider import OllamaProvider


@pytest.mark.asyncio
async def test_get_llm_provider_async_openai_compatible():
    settings = {
        "llm_provider": "openai_compatible",
        "llm_base_url": "https://custom-llm.com/v1",
        "llm_api_key": "custom-key",
        "llm_model": "custom-model",
    }

    async def mock_get_setting(key: str):
        return settings.get(key)

    with patch("app.providers.factory.get_app_setting", side_effect=mock_get_setting):
        provider = await get_llm_provider_async()

        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider._base_url == "https://custom-llm.com/v1"
        assert provider._model == "custom-model"


@pytest.mark.asyncio
async def test_get_llm_provider_async_ollama():
    settings = {
        "llm_provider": "ollama",
        "ollama_base_url": "http://127.0.0.1:11434",
        "ollama_model": "llama3.2:3b",
    }

    async def mock_get_setting(key: str):
        return settings.get(key)

    with patch("app.providers.factory.get_app_setting", side_effect=mock_get_setting):
        provider = await get_llm_provider_async()

        assert isinstance(provider, OllamaProvider)
        assert provider._base_url == "http://127.0.0.1:11434"
        assert provider._model_name == "llama3.2:3b"


@pytest.mark.asyncio
async def test_get_llm_provider_async_auto_fallback_ollama_when_no_api_key():
    settings = {
        "llm_provider": "openai_compatible",
        "llm_api_key": "",
        "ollama_base_url": "http://localhost:11434",
        "ollama_model": "llama3.2",
    }

    async def mock_get_setting(key: str):
        return settings.get(key)

    with patch("app.providers.factory.get_app_setting", side_effect=mock_get_setting):
        provider = await get_llm_provider_async()

        assert isinstance(provider, OllamaProvider)
        assert provider._base_url == "http://localhost:11434"
        assert provider._model_name == "llama3.2"


@pytest.mark.asyncio
async def test_get_llm_provider_async_legacy_fallback_gemini():
    settings = {
        "llm_provider": "gemini",
        "gemini_api_key": "legacy-gemini-key",
        "gemini_model": "gemini-1.5-pro",
    }

    async def mock_get_setting(key: str):
        return settings.get(key)

    with patch("app.providers.factory.get_app_setting", side_effect=mock_get_setting):
        provider = await get_llm_provider_async()

        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider._base_url == "https://generativelanguage.googleapis.com/v1beta/openai"
        assert provider._model == "gemini-1.5-pro"


@pytest.mark.asyncio
async def test_get_llm_provider_async_legacy_fallback_groq():
    settings = {
        "llm_provider": "groq",
        "groq_api_key": "legacy-groq-key",
        "groq_model": "llama-3.3-70b-versatile",
    }

    async def mock_get_setting(key: str):
        return settings.get(key)

    with patch("app.providers.factory.get_app_setting", side_effect=mock_get_setting):
        provider = await get_llm_provider_async()

        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider._base_url == "https://api.groq.com/openai/v1"
        assert provider._model == "llama-3.3-70b-versatile"

