-- =============================================================================
-- Migration: app_settings
-- Created At: 2026-08-12
-- Purpose: Persistent key-value table for encrypted provider API keys,
--          local model endpoints, and active pipeline provider selections.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by key
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings (key);

-- Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trigger_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_app_settings_updated_at();

-- Seed default settings keys (unpopulated)
INSERT INTO public.app_settings (key, value, is_encrypted, category, description)
VALUES 
    ('llm_provider', 'gemini', false, 'providers', 'Active LLM Provider (gemini | groq | openai | ollama)'),
    ('tts_provider', 'edge_tts', false, 'providers', 'Active TTS Provider (edge_tts | kokoro | elevenlabs)'),
    ('image_provider', 'sdxl', false, 'providers', 'Active Image Provider (sdxl | pexels)'),
    ('broll_provider', 'pexels', false, 'providers', 'Active B-Roll Provider (pexels | pixabay)'),
    ('ollama_base_url', 'http://localhost:11434', false, 'local_ai', 'Base HTTP URL for Ollama local service'),
    ('ollama_model', 'llama3.2', false, 'local_ai', 'Default model name for local Ollama LLM')
ON CONFLICT (key) DO NOTHING;
