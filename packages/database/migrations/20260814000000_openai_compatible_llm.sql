-- =============================================================================
-- Migration: openai_compatible_llm
-- Created At: 2026-08-14
-- Purpose: Add unified OpenAI-compatible settings keys to app_settings
-- =============================================================================

INSERT INTO public.app_settings (key, value, is_encrypted, category, description) VALUES
  ('llm_base_url', 'https://openrouter.ai/api/v1', false, 'providers', 'Base URL for OpenAI-compatible endpoint'),
  ('llm_api_key', '', true, 'api_keys', 'API key for OpenAI-compatible endpoint'),
  ('llm_model', 'google/gemini-flash-1.5', false, 'providers', 'Default model for OpenAI-compatible endpoint'),
  ('llm_provider', 'openai_compatible', false, 'providers', 'Active LLM Provider (openai_compatible | ollama)')
ON CONFLICT (key) DO NOTHING;
