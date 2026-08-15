"""
Provider factory — creates and returns the configured provider implementations.

Business logic calls get_llm_provider_async(), get_search_provider_async(), etc.
The factory reads dynamic configuration from PostgreSQL `app_settings` (with AES-256 decryption)
and returns the appropriate concrete class.
"""
from functools import lru_cache
import structlog

from app.core.config import get_settings
from app.core.db import get_app_setting
from app.providers.llm.base import ILLMProvider
from app.providers.search.base import ISearchProvider
from app.providers.tts.base import ITTSProvider
from app.providers.stock.base import IStockProvider
from app.providers.image.base import IImageProvider

logger = structlog.get_logger(__name__)


async def get_llm_provider_async() -> ILLMProvider:
    """Return the dynamically configured LLM provider instance based on app_settings."""
    provider_name = (await get_app_setting("llm_provider")) or "openai_compatible"

    if provider_name == "ollama":
        from app.providers.llm.ollama_provider import OllamaProvider
        base_url = (
            (await get_app_setting("ollama_base_url"))
            or (await get_app_setting("llm_base_url"))
            or "http://localhost:11434"
        )
        model = (
            (await get_app_setting("ollama_model"))
            or (await get_app_setting("llm_model"))
            or "llama3.2"
        )
        logger.info("llm_provider_loaded", provider="ollama", base_url=base_url, model=model)
        return OllamaProvider(base_url=base_url, model=model)

    # Default: openai_compatible (openrouter, groq, omniroute, ollama/v1, openai)
    from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider
    base_url = (await get_app_setting("llm_base_url")) or "https://openrouter.ai/api/v1"
    api_key = (await get_app_setting("llm_api_key")) or ""
    model = (await get_app_setting("llm_model")) or "google/gemini-flash-1.5"

    if not api_key:
        legacy = await _legacy_llm_config(provider_name)
        if legacy:
            logger.warning("deprecated_llm_keys", msg="Migrate to llm_base_url/llm_api_key/llm_model")
            return legacy

        # Auto-fallback to local Ollama if no API key is provided
        from app.providers.llm.ollama_provider import OllamaProvider
        ollama_url = (
            (await get_app_setting("ollama_base_url"))
            or (await get_app_setting("llm_base_url"))
            or "http://localhost:11434"
        )
        ollama_model = (
            (await get_app_setting("ollama_model"))
            or (await get_app_setting("llm_model"))
            or "llama3.2"
        )
        logger.warning(
            "llm_no_api_key_falling_back_to_ollama",
            msg="No LLM API key configured; falling back to local Ollama instance.",
            base_url=ollama_url,
            model=ollama_model,
        )
        return OllamaProvider(base_url=ollama_url, model=ollama_model)

    logger.info("llm_provider_loaded", provider="openai_compatible", base_url=base_url, model=model)
    return OpenAICompatibleProvider(base_url=base_url, api_key=api_key, model=model)


async def _legacy_llm_config(provider_name: str) -> ILLMProvider | None:
    """Read old per-vendor keys during migration window. Remove in 2 releases."""
    from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider

    if provider_name == "gemini":
        key = await get_app_setting("gemini_api_key")
        if key:
            model = (await get_app_setting("gemini_model")) or "gemini-1.5-flash"
            return OpenAICompatibleProvider(
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=key,
                model=model,
            )
    elif provider_name == "groq":
        key = await get_app_setting("groq_api_key")
        if key:
            model = (await get_app_setting("groq_model")) or "llama-3.3-70b-versatile"
            return OpenAICompatibleProvider(
                base_url="https://api.groq.com/openai/v1",
                api_key=key,
                model=model,
            )
    elif provider_name in ("openrouter", "openai"):
        key = (await get_app_setting("openrouter_api_key")) or (await get_app_setting("openai_api_key"))
        if key:
            base_url = "https://api.openai.com/v1" if provider_name == "openai" else "https://openrouter.ai/api/v1"
            model = (await get_app_setting("openrouter_model")) or "google/gemini-flash-1.5"
            return OpenAICompatibleProvider(
                base_url=base_url,
                api_key=key,
                model=model,
            )
    elif provider_name not in ("openai_compatible", "ollama"):
        logger.warning("unknown_llm_provider_fallback", provider=provider_name)

    return None


async def get_search_provider_async() -> ISearchProvider:
    api_key = (await get_app_setting("tavily_api_key")) or ""
    from app.providers.search.tavily_provider import TavilyProvider
    return TavilyProvider(api_key=api_key)


async def get_tts_provider_async() -> ITTSProvider:
    provider_name = (await get_app_setting("tts_provider")) or "edge_tts"

    if provider_name == "edge_tts":
        from app.providers.tts.edge_tts_provider import EdgeTTSProvider
        return EdgeTTSProvider()

    if provider_name == "kokoro":
        from app.providers.tts.kokoro_provider import KokoroProvider
        return KokoroProvider()

    from app.providers.tts.edge_tts_provider import EdgeTTSProvider
    return EdgeTTSProvider()


async def get_stock_provider_async() -> IStockProvider:
    api_key = (await get_app_setting("pexels_api_key")) or ""
    from app.providers.stock.pexels_provider import PexelsProvider
    return PexelsProvider(api_key=api_key)


async def get_image_provider_async() -> IImageProvider:
    token = (await get_app_setting("cloudflare_workers_ai_token")) or (await get_app_setting("cloudflare_api_key")) or ""
    account_id = (await get_app_setting("cloudflare_account_id")) or ""
    from app.providers.image.cloudflare_provider import CloudflareImageProvider
    return CloudflareImageProvider(account_id=account_id, token=token)

