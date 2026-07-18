"""
Provider factory — creates and returns the configured provider implementations.

Business logic calls get_llm_provider(), get_search_provider(), etc.
The factory reads configuration and returns the appropriate concrete class.
This is the ONLY place where concrete provider classes are imported.
"""
from functools import lru_cache

import structlog

from app.core.config import get_settings
from app.providers.llm.base import ILLMProvider
from app.providers.search.base import ISearchProvider
from app.providers.tts.base import ITTSProvider
from app.providers.stock.base import IStockProvider
from app.providers.image.base import IImageProvider

logger = structlog.get_logger(__name__)


@lru_cache
def get_llm_provider() -> ILLMProvider:
    """Return the configured LLM provider singleton."""
    settings = get_settings()

    if settings.llm_provider == "gemini":
        from app.providers.llm.gemini_provider import GeminiProvider
        logger.info("llm_provider_loaded", provider="gemini", model=settings.gemini_model)
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)

    if settings.llm_provider == "groq":
        from app.providers.llm.groq_provider import GroqProvider
        logger.info("llm_provider_loaded", provider="groq", model=settings.groq_model)
        return GroqProvider(api_key=settings.groq_api_key, model=settings.groq_model)

    if settings.llm_provider == "openrouter":
        from app.providers.llm.openrouter_provider import OpenRouterProvider
        logger.info("llm_provider_loaded", provider="openrouter", model=settings.openrouter_model)
        return OpenRouterProvider(
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
        )

    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")


@lru_cache
def get_search_provider() -> ISearchProvider:
    """Return the configured web search provider singleton."""
    settings = get_settings()

    if settings.search_provider == "tavily":
        from app.providers.search.tavily_provider import TavilyProvider
        logger.info("search_provider_loaded", provider="tavily")
        return TavilyProvider(api_key=settings.tavily_api_key)

    if settings.search_provider == "brave":
        from app.providers.search.brave_provider import BraveProvider
        logger.info("search_provider_loaded", provider="brave")
        return BraveProvider(api_key=settings.brave_search_api_key)

    raise ValueError(f"Unknown search provider: {settings.search_provider}")


@lru_cache
def get_tts_provider() -> ITTSProvider:
    """Return the configured TTS provider singleton."""
    settings = get_settings()

    if settings.tts_provider == "kokoro":
        from app.providers.tts.kokoro_provider import KokoroProvider
        logger.info("tts_provider_loaded", provider="kokoro")
        return KokoroProvider(model_path=settings.kokoro_model_path)

    if settings.tts_provider == "coqui":
        from app.providers.tts.coqui_provider import CoquiProvider
        logger.info("tts_provider_loaded", provider="coqui")
        return CoquiProvider(model_path=settings.coqui_model_path)

    if settings.tts_provider == "edge_tts":
        from app.providers.tts.edge_tts_provider import EdgeTTSProvider
        logger.info("tts_provider_loaded", provider="edge_tts", voice=settings.edge_tts_voice)
        return EdgeTTSProvider(default_voice=settings.edge_tts_voice)

    raise ValueError(f"Unknown TTS provider: {settings.tts_provider}")


@lru_cache
def get_stock_provider() -> IStockProvider:
    """Return the configured stock media provider singleton."""
    settings = get_settings()
    # Pexels is the default — Pixabay support can be added as a second provider
    from app.providers.stock.pexels_provider import PexelsProvider
    logger.info("stock_provider_loaded", provider="pexels")
    return PexelsProvider(api_key=settings.pexels_api_key)


@lru_cache
def get_image_provider() -> IImageProvider:
    """Return the configured image generation provider singleton."""
    settings = get_settings()

    if settings.image_provider == "cloudflare":
        from app.providers.image.cloudflare_provider import CloudflareImageProvider
        logger.info("image_provider_loaded", provider="cloudflare")
        return CloudflareImageProvider(
            account_id=settings.cloudflare_account_id,
            token=settings.cloudflare_workers_ai_token,
        )

    if settings.image_provider == "sdxl_local":
        from app.providers.image.sdxl_local_provider import SDXLLocalProvider
        logger.info("image_provider_loaded", provider="sdxl_local")
        return SDXLLocalProvider()

    raise ValueError(f"Unknown image provider: {settings.image_provider}")
