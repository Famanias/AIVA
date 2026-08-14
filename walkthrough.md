# Walkthrough: LLM Provider Consolidation — Phases 1 to 4 Complete

Consolidated `GeminiProvider`, `GroqProvider`, and `OpenRouterProvider` into a single, unified `OpenAICompatibleProvider` conforming to `ILLMProvider`. Extended `ILLMProvider` with `generate_stream()` and `list_models()`. Retained `OllamaProvider` as a dedicated native adapter. Added database migration for new configuration keys, overhauled Settings UI & API routes, and cleaned up legacy provider files and unused dependencies.

---

## Changes Implemented

### 1. Provider Layer (`apps/workers/app/providers/llm/`)
- **[base.py](file:///d:/repos/AIVA/apps/workers/app/providers/llm/base.py)**:
  - Added `@dataclass class ModelInfo(id: str, owned_by: str | None, context_window: int | None)`.
  - Added abstract methods `generate_stream(prompt, system_prompt, context) -> AsyncGenerator[str, None]` and `list_models() -> list[ModelInfo]`.
- **[openai_compatible_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/llm/openai_compatible_provider.py)** *(NEW)*:
  - Implements `ILLMProvider` using `AsyncOpenAI`.
  - Handles `generate_text` and `generate_json` with tenacity retry policy and automatic Markdown fence stripping.
  - Implements fallback prompt-reinforcement retry if `json.JSONDecodeError` occurs.
  - Implements `generate_stream` yielding delta tokens and `list_models` with single-model fallback.
- **[ollama_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/llm/ollama_provider.py)**:
  - Extended with `generate_stream` (streaming line-by-line response from `/api/generate`).
  - Extended with `list_models` (parsing tags from `/api/tags`).
- **[mock_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/llm/mock_provider.py)**:
  - Extended with deterministic mock `generate_stream` and `list_models`.
- **Deleted Legacy Providers**:
  - `apps/workers/app/providers/llm/gemini_provider.py`
  - `apps/workers/app/providers/llm/groq_provider.py`
  - `apps/workers/app/providers/llm/openrouter_provider.py`

### 2. Dead Provider Stubs Cleanup
- Removed dead and unused stubs:
  - `apps/workers/app/providers/search/brave_provider.py`
  - `apps/workers/app/providers/image/sdxl_local_provider.py`
  - `apps/workers/app/providers/tts/coqui_provider.py`
  - `apps/workers/app/providers/tts/mock_provider.py`

### 3. Dependencies Cleanup (`apps/workers/requirements.txt`)
- Removed `google-generativeai==0.8.0` and `groq==0.11.0`.
- Kept `openai==1.51.0` for all OpenAI-compatible protocol interactions.

### 4. Provider Factory & Configuration (`apps/workers/app/`)
- **[factory.py](file:///d:/repos/AIVA/apps/workers/app/providers/factory.py)**:
  - Updated `get_llm_provider_async` to resolve `openai_compatible` as default, reading `llm_base_url`, `llm_api_key`, `llm_model`.
  - Resolves `ollama` with `ollama_base_url` / `ollama_model`.
  - Includes `_legacy_llm_config` deprecation fallback reading `gemini_api_key`, `groq_api_key`, `openrouter_api_key` with warning logs.
  - Updated sync `get_llm_provider` fallback.
- **[config.py](file:///d:/repos/AIVA/apps/workers/app/core/config.py)**:
  - Added `llm_base_url`, `llm_api_key`, `llm_model`, `ollama_base_url`, and `ollama_model` to `Settings`.

### 5. Settings UI & Next.js API Routes (`apps/web/`)
- **[page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/settings/page.tsx)**:
  - Updated provider selector to `openai_compatible` and `ollama`.
  - Added unified OpenAI-Compatible configuration panel with endpoint presets (Cloud/Direct, Local Gateway, Local Hardware).
  - Added "Fetch Models" button that dynamically queries the endpoint.
  - Removed deprecated per-vendor key inputs.
- **[route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/route.ts)**:
  - Replaced legacy keys in `SETTINGS_KEYS` and `ENCRYPTED_KEYS` with `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider`.
- **[models/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/models/route.ts)** *(NEW)*:
  - Implemented GET endpoint fetching models from `/v1/models` of the configured `llm_base_url`.

### 6. Database Migrations (`packages/database/migrations/`)
- **[20260814000000_openai_compatible_llm.sql](file:///d:/repos/AIVA/packages/database/migrations/20260814000000_openai_compatible_llm.sql)** *(NEW)*:
  - Seeds default keys `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider` into `app_settings`.

---

## Automated Verification

### 1. Pytest Suite in `apps/workers`
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python -m pytest apps/workers/tests
```
**Result**: `33 passed, 5 warnings in 8.89s`

### 2. Golden Suite Pipeline Certification
```powershell
pnpm certify
```
**Result**: `✅ ALL 5 SUITES PASSED`

### 3. Next.js Production Web Build
```powershell
pnpm --filter web build
```
**Result**: `✓ Compiled successfully, 15 static/dynamic routes generated.`

---

## Manual QA Instructions

To manually verify the full consolidation:

1. **Verify Python Provider Imports & Initialization**:
   ```powershell
   $env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python -c "from app.providers.factory import get_llm_provider; p = get_llm_provider(); print('Loaded provider:', type(p).__name__, 'Base URL:', p._base_url)"
   ```
   **Expected Result**: Prints `Loaded provider: OpenAICompatibleProvider Base URL: https://openrouter.ai/api/v1` (or your configured URL).

2. **Verify Settings API & UI**:
   - Open `http://localhost:3000/settings`.
   - Verify the "OpenAI-Compatible LLM Configuration" section is visible.
   - Click "Local Gateway (OmniRoute)" or "Cloud / Direct (OpenRouter)" to test preset auto-fill.
   - Click "Fetch Models" to test dynamic model population from your endpoint.
