"""
Application configuration via environment variables.

All configuration is injected — nothing is hardcoded.
See RULES Rule 7 — Zero Hardcoding.
"""
from functools import lru_cache
from typing import Literal

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV), "../.env", "../../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    web_app_url: str = "http://localhost:3000"
    node_env: str = "development"

    # -------------------------------------------------------------------------
    # Database (Supabase)
    # -------------------------------------------------------------------------
    supabase_url: str
    supabase_service_role_key: str

    # -------------------------------------------------------------------------
    # Redis
    # -------------------------------------------------------------------------
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_password: str = ""

    # -------------------------------------------------------------------------
    # LLM Provider
    # -------------------------------------------------------------------------
    llm_provider: str = "openai_compatible"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = "google/gemini-flash-1.5"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-flash-1.5"

    # -------------------------------------------------------------------------
    # Web Search Provider
    # -------------------------------------------------------------------------
    search_provider: Literal["tavily", "brave", "serpapi"] = "tavily"
    tavily_api_key: str = ""
    brave_search_api_key: str = ""
    serpapi_key: str = ""

    # -------------------------------------------------------------------------
    # TTS Provider
    # -------------------------------------------------------------------------
    tts_provider: Literal["kokoro", "coqui", "edge_tts"] = "kokoro"
    edge_tts_voice: str = "en-US-AriaNeural"
    # Kokoro/Coqui are loaded via local model path — no API key needed
    kokoro_model_path: str = "models/kokoro"
    coqui_model_path: str = "models/coqui"

    # -------------------------------------------------------------------------
    # Stock Media Provider
    # -------------------------------------------------------------------------
    pexels_api_key: str = ""
    pixabay_api_key: str = ""

    # -------------------------------------------------------------------------
    # Image Generation Provider
    # -------------------------------------------------------------------------
    image_provider: Literal["cloudflare", "sdxl_local"] = "cloudflare"
    cloudflare_account_id: str = ""
    cloudflare_workers_ai_token: str = ""

    # -------------------------------------------------------------------------
    # Storage Provider
    # -------------------------------------------------------------------------
    storage_provider: Literal["supabase", "s3"] = "supabase"
    s3_endpoint: str = ""
    s3_bucket: str = "aiva-assets"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "us-east-1"

    # -------------------------------------------------------------------------
    # Template Renderer (Node.js Remotion worker)
    # -------------------------------------------------------------------------
    template_renderer_url: str = "http://localhost:3001"

    # -------------------------------------------------------------------------
    # Security
    # -------------------------------------------------------------------------
    database_encryption_key: str = ""


@lru_cache
def get_settings() -> Settings:
    """
    Returns the cached application settings singleton.
    Call get_settings() everywhere instead of constructing Settings() directly.
    """
    return Settings()
