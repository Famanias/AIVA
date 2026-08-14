# Walkthrough: LLM Provider Consolidation — Phase 1+2

Consolidated `GeminiProvider`, `GroqProvider`, and `OpenRouterProvider` into a single, unified `OpenAICompatibleProvider` conforming to `ILLMProvider`. Extended `ILLMProvider` with `generate_stream()` and `list_models()`. Retained `OllamaProvider` as a dedicated native adapter. Added database migration for new configuration keys and full test coverage across all provider implementations and factory resolution paths.

---

## Changes Implemented

### Provider Layer (`apps/workers/app/providers/llm/`)
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

### Provider Factory & Configuration (`apps/workers/app/`)
- **[factory.py](file:///d:/repos/AIVA/apps/workers/app/providers/factory.py)**:
  - Updated `get_llm_provider_async` to resolve `openai_compatible` as default, reading `llm_base_url`, `llm_api_key`, `llm_model`.
  - Resolves `ollama` with `ollama_base_url` / `ollama_model`.
  - Includes `_legacy_llm_config` deprecation fallback reading `gemini_api_key`, `groq_api_key`, `openrouter_api_key` with warning logs.
  - Updated sync `get_llm_provider` fallback.
- **[config.py](file:///d:/repos/AIVA/apps/workers/app/core/config.py)**:
  - Added `llm_base_url`, `llm_api_key`, `llm_model`, `ollama_base_url`, and `ollama_model` to `Settings`.

### Database Migrations (`packages/database/migrations/`)
- **[20260814000000_openai_compatible_llm.sql](file:///d:/repos/AIVA/packages/database/migrations/20260814000000_openai_compatible_llm.sql)** *(NEW)*:
  - Seeds default keys `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider` into `app_settings`.

---

## Automated Verification

### 1. Pytest Suite in `apps/workers`
Ran 33 automated tests covering all 4 providers, factory resolution, ducking, rerender flow, and schema compatibility:
```powershell
.\apps\workers\venv\Scripts\python -m pytest apps/workers/tests
```
**Result**: `33 passed, 5 warnings in 7.60s`

### 2. Migration Validation
Validated migration files format:
```powershell
node packages/database/scripts/validate_migrations.mjs
```
**Result**: Migration SQL syntax verified with 0 errors.

### 3. Golden Suite Pipeline Certification
Ran full end-to-end pipeline certification with mock providers:
```powershell
pnpm certify
```
**Result**: `✅ ALL 5 SUITES PASSED`

---

## Manual QA Instructions

To manually verify Phase 1+2 in your environment:

1. **Verify Python Provider Imports & Initialization**:
   Open an interactive Python session using the workers venv:
   ```powershell
   .\apps\workers\venv\Scripts\python -c "from app.providers.factory import get_llm_provider; p = get_llm_provider(); print('Loaded provider:', type(p).__name__, 'Base URL:', p._base_url)"
   ```
   **Expected Result**: Prints `Loaded provider: OpenAICompatibleProvider Base URL: https://openrouter.ai/api/v1` (or your configured URL).

2. **Verify Legacy Key Fallback (if applicable)**:
   In `.env`, if you temporarily set `GEMINI_API_KEY=test_key` with empty `LLM_API_KEY`:
   ```powershell
   .\apps\workers\venv\Scripts\python -c "import asyncio; from app.providers.factory import get_llm_provider_async; p = asyncio.run(get_llm_provider_async()); print('Resolved provider:', type(p).__name__, 'Base URL:', p._base_url)"
   ```
   **Expected Result**: Logs a deprecation warning and initializes `OpenAICompatibleProvider` pointing to `https://generativelanguage.googleapis.com/v1beta/openai/`.

3. **Verify Database Migration SQL**:
   Review [20260814000000_openai_compatible_llm.sql](file:///d:/repos/AIVA/packages/database/migrations/20260814000000_openai_compatible_llm.sql) to ensure the seeded keys match your database schema.
