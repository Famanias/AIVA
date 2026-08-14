# ADR 006: Consolidate LLM Providers Behind a Single OpenAI-Compatible Provider

## Status
Accepted

## Context
AIVA's LLM layer shipped with four per-vendor providers — `GeminiProvider`, `GroqProvider`, `OpenRouterProvider`, and `OllamaProvider` — each wrapping a different SDK (`google-generativeai`, `groq`, `openai`, raw `httpx`) behind the `ILLMProvider` seam. Every new provider meant a new class, new SDK dependency, new env vars, and duplicated retry/JSON-parsing logic. The pipeline agents (`research_agent`, `outline_agent`, `script_director_agent`) only ever call `generate_text` / `generate_json` and never touch an SDK directly, so the per-vendor wrappers were pure translation layers — shallow modules.

The trigger was a proposed architecture change (`model_architecture_review.md`): every target provider (OpenRouter, Groq, OmniRoute, Ollama/v1, OpenAI) speaks the OpenAI-compatible protocol. A single provider can address all of them via one `base_url` + `api_key` + `model` configuration.

## Considered Options
- **Option A — OpenAI-centric**: Every user installs OmniRoute as a mandatory gateway. Rejected: unnecessary friction for users who just want OpenRouter directly.
- **Option B — Per-vendor SDKs (status quo)**: Rejected: maintenance burden, duplicated logic, no fallbacks, no streaming.
- **Option C — Single OpenAI-compatible provider**: Adopt `OpenAICompatibleProvider` speaking the OpenAI protocol. OmniRoute/Ollama optional via Base URL. **Selected.**

## Decision
1. **One provider module.** `OpenAICompatibleProvider(ILLMProvider)` implements all LLM access via the `openai` SDK (`AsyncOpenAI`), configured with a generic `base_url`, `api_key`, and `model`.
2. **Ollama kept as a first-class adapter.** `OllamaProvider` remains for users who want Ollama's native API (`/api/generate`, `/api/tags`); the generic provider covers Ollama's experimental `/v1` endpoint for users who prefer one configuration path. Two adapters justify the seam.
3. **Interface extension.** `ILLMProvider` gains `generate_stream()` (returns `AsyncGenerator[str]`) and `list_models()` (returns `list[ModelInfo]`). `generate_json` uses weak `json_object` mode + post-validation retry — no strict JSON-Schema enforcement (matches current Groq/OpenRouter/Ollama behavior; only Gemini previously enforced schema, and that capability is dropped).
4. **Settings keys.** New generic keys `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider` (enum: `openai_compatible | ollama`) replace per-vendor keys (`gemini_api_key`, etc.). Legacy per-vendor keys remain readable for two releases with a deprecation warning.
5. **Structured output is best-effort.** No `ProviderCapabilities` seam (deferred as speculative per Rule 11). Endpoints that don't support `json_object` fall back to prompt-constrained parsing; callers handle `LLMProviderError` as today.

## Consequences
- **Positive**: Deletes 3 SDK dependencies (`google-generativeai`, `groq`, and the OpenRouter-specific wrapper). All retry/JSON-fallback/capability logic concentrates in one module (locality). Any OpenAI-compatible endpoint works without code changes (leverage). Streaming and model discovery become first-class.
- **Negative**: Loss of Gemini-native JSON-Schema enforcement (mitigated: the pipeline's two `generate_json` call sites already work without it). Risk that an exotic endpoint lacks `json_object`/`/v1/models`/streaming (mitigated: graceful degradation inside the provider).
- **Migration**: Four phases — (1+2) provider + factory + DB keys; (3) UI presets; (4) old-provider SDK removal.
