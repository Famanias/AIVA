# Implementation Spec: LLM Provider Consolidation (Candidate 1 / ADR-006)

**Handoff document for implementation agent.**

## Goal

Collapse `GeminiProvider`, `GroqProvider`, `OpenRouterProvider` into ONE `OpenAICompatibleProvider(ILLMProvider)` that speaks the OpenAI Chat Completions protocol to any OpenAI-compatible endpoint (OpenRouter, Groq, OmniRoute, Ollama `/v1`, OpenAI). Keep `OllamaProvider` as a separate native adapter (it uses Ollama's native `/api/generate` + `/api/tags`, not the OpenAI protocol). Extend `ILLMProvider` with `generate_stream()` and `list_models()`.

**CRITICAL: No caller changes required.** The three pipeline agents already call the seam correctly:
- `apps/workers/app/agents/research_agent.py:93` → `generate_text(...)`
- `apps/workers/app/agents/outline_agent.py:92` → `generate_json(..., json_schema=OUTLINE_SCHEMA)`
- `apps/workers/app/agents/script_director_agent.py:117` → `generate_json(..., json_schema=SCRIPT_DIRECTOR_SCHEMA)`

Do NOT modify these agents.

## Decision Record (from ADR-006)

1. One provider module: `OpenAICompatibleProvider` via `openai` SDK (`AsyncOpenAI`), configured with `base_url` + `api_key` + `model`.
2. `OllamaProvider` kept as first-class adapter for native Ollama API. Generic provider covers Ollama `/v1` for users who want one config path.
3. `ILLMProvider` gains `generate_stream()` (returns `AsyncGenerator[str]`) and `list_models()` (returns `list[ModelInfo]`). `generate_json` uses weak `json_object` mode + post-validation retry — NO strict JSON-Schema enforcement.
4. New settings keys: `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider` (enum: `openai_compatible | ollama`). Legacy per-vendor keys (`gemini_api_key`, etc.) remain readable for 2 releases with deprecation warning.
5. No `ProviderCapabilities` seam (deferred). Endpoints that don't support `json_object` fall back to prompt-constrained parsing.

## Current State (facts you can verify)

- `ILLMProvider` lives in `apps/workers/app/providers/llm/base.py` — currently has `generate_text` + `generate_json` (abstract) + `LLMProviderError`.
- `factory.py:22-57` — `get_llm_provider_async()` switches on `llm_provider` setting (gemini/groq/openrouter/ollama), reads per-vendor keys.
- `get_app_setting(key: str) -> Optional[str]` at `apps/workers/app/core/db.py:71` — reads from `app_settings` table, decrypts if `is_encrypted`.
- `MockLLMProvider` at `apps/workers/app/providers/llm/mock_provider.py` — implements `generate_text` + `generate_json` for CI. MUST implement the 2 new methods.
- `OllamaProvider` at `apps/workers/app/providers/llm/ollama_provider.py` — native API. MUST implement the 2 new methods.
- `openai` SDK already a dependency (OpenRouterProvider imports `AsyncOpenAI`).
- Migration runner: `pnpm db:migrate` (per ADR-005) executes SQL in `packages/database/migrations/`.

---

## Phase 1+2 — Provider + Factory + DB Keys (ONE PR)

### File 1: `apps/workers/app/providers/llm/base.py` (EXTEND)

Add `ModelInfo` dataclass and two abstract methods. Keep `LLMProviderError` unchanged.

```python
from dataclasses import dataclass
from typing import Any, AsyncGenerator

@dataclass
class ModelInfo:
    id: str
    owned_by: str | None = None
    context_window: int | None = None

class ILLMProvider(ABC):
    @abstractmethod
    async def generate_text(self, prompt, system_prompt=None, context=None, prompt_id=None, prompt_version=None) -> str: ...

    @abstractmethod
    async def generate_json(self, prompt, system_prompt, json_schema, context=None, prompt_id=None, prompt_version=None) -> Any: ...

    @abstractmethod
    async def generate_stream(self, prompt, system_prompt=None, context=None) -> AsyncGenerator[str, None, None]: ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]: ...
```

**Invariants:** `generate_stream` yields `str` deltas (never `None`); `list_models` always returns non-empty list (fall back to `[ModelInfo(id=self._model)]` when endpoint lacks `/v1/models`).

### File 2: `apps/workers/app/providers/llm/openai_compatible_provider.py` (NEW)

```python
"""
OpenAICompatibleProvider — speaks the OpenAI Chat Completions protocol to ANY
OpenAI-compatible endpoint (OpenRouter, Groq, OmniRoute, Ollama/v1, OpenAI).
Implements ILLMProvider. All retry/fence-stripping/json-fallback logic lives here.
"""
import json
import re
from typing import Any, AsyncGenerator, Callable

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.llm.base import ILLMProvider, LLMProviderError, ModelInfo

logger = structlog.get_logger(__name__)

_RETRY_POLICY = dict(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(Exception),
    reraise=False,
)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class OpenAICompatibleProvider(ILLMProvider):
    def __init__(self, base_url: str, api_key: str, model: str, client_factory: Callable[..., "AsyncOpenAI"] = None) -> None:
        from openai import AsyncOpenAI
        factory = client_factory or AsyncOpenAI
        self._client = factory(base_url=base_url.rstrip("/"), api_key=api_key)
        self._model = model
        self._base_url = base_url.rstrip("/")

    @retry(**_RETRY_POLICY)
    async def generate_text(self, prompt, system_prompt=None, context=None, prompt_id=None, prompt_version=None) -> str:
        messages = [{"role": "system", "content": system_prompt}] if system_prompt else []
        messages.append({"role": "user", "content": prompt})
        try:
            resp = await self._client.chat.completions.create(model=self._model, messages=messages)
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error("oai_generate_text_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_text failed: {e}", e)

    @retry(**_RETRY_POLICY)
    async def generate_json(self, prompt, system_prompt, json_schema, context=None, prompt_id=None, prompt_version=None) -> Any:
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]
        try:
            resp = await self._client.chat.completions.create(
                model=self._model, messages=messages, response_format={"type": "json_object"})
            raw = resp.choices[0].message.content or ""
            return self._parse_json(raw)
        except json.JSONDecodeError:
            logger.warning("oai_json_object_failed", retrying=True)
            try:
                reinforced = system_prompt + "\n\nRespond with ONLY valid JSON. No prose, no code fences."
                resp = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "system", "content": reinforced}, {"role": "user", "content": prompt}])
                return self._parse_json(resp.choices[0].message.content or "")
            except json.JSONDecodeError as e:
                raise LLMProviderError("openai_compatible", f"Response was not valid JSON: {e}", e)
        except Exception as e:
            logger.error("oai_generate_json_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_json failed: {e}", e)

    async def generate_stream(self, prompt, system_prompt=None, context=None) -> AsyncGenerator[str, None, None]:
        messages = [{"role": "system", "content": system_prompt}] if system_prompt else []
        messages.append({"role": "user", "content": prompt})
        try:
            stream = await self._client.chat.completions.create(
                model=self._model, messages=messages, stream=True)
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
        except Exception as e:
            logger.error("oai_generate_stream_failed", error=str(e))
            raise LLMProviderError("openai_compatible", f"generate_stream failed: {e}", e)

    async def list_models(self) -> list[ModelInfo]:
        try:
            resp = await self._client.models.list()
            return [ModelInfo(id=m.id, owned_by=getattr(m, "owned_by", None)) for m in resp.data]
        except Exception as e:
            logger.debug("oai_models_list_unsupported", error=str(e))
            return [ModelInfo(id=self._model, owned_by="unknown")]

    @staticmethod
    def _parse_json(raw: str) -> Any:
        cleaned = _FENCE_RE.sub("", raw.strip())
        return json.loads(cleaned)
```

**Implementer notes:**
- Import `openai` *inside* `__init__` (lazy) so module loads without SDK in test envs that inject `client_factory`.
- `_parse_json` centralizes fence-stripping previously duplicated across groq/openrouter/ollama.
- `list_models` never raises for capability absence — returns `[ModelInfo(id=self._model)]`.

### File 3: `apps/workers/app/providers/llm/mock_provider.py` (EXTEND)

Add to `MockLLMProvider`:

```python
import asyncio
from app.providers.llm.base import ModelInfo

async def generate_stream(self, prompt, system_prompt=None, context=None) -> AsyncGenerator[str, None, None]:
    text = "This is a deterministic mock streaming response for CI."
    for word in text.split():
        yield word + " "
        await asyncio.sleep(0.01)

async def list_models(self) -> list[ModelInfo]:
    return [ModelInfo(id="mock-model", owned_by="aiva-mock")]
```

### File 4: `apps/workers/app/providers/llm/ollama_provider.py` (KEEP + EXTEND)

Add `generate_stream` + `list_models` so it satisfies the extended interface. Leave `generate_text` / `generate_json` unchanged.

- `generate_stream`: POST `/api/generate` with `stream: true`; parse each line's `response` field, yield it.
- `list_models`: GET `/api/tags` → `[ModelInfo(id=m["name"], owned_by="ollama") for m in data["models"]]`.

### File 5: `apps/workers/app/providers/factory.py` (REFACTOR LLM SECTION)

Replace lines 22–57 (`get_llm_provider_async`) with:

```python
async def get_llm_provider_async() -> ILLMProvider:
    provider_name = (await get_app_setting("llm_provider")) or "openai_compatible"

    if provider_name == "ollama":
        from app.providers.llm.ollama_provider import OllamaProvider
        base_url = (await get_app_setting("ollama_base_url")) or (await get_app_setting("llm_base_url")) or "http://localhost:11434"
        model = (await get_app_setting("ollama_model")) or (await get_app_setting("llm_model")) or "llama3.2"
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

    return OpenAICompatibleProvider(base_url=base_url, api_key=api_key, model=model)


async def _legacy_llm_config(provider_name: str) -> ILLMProvider | None:
    """Read old per-vendor keys during migration window. Remove in 2 releases."""
    if provider_name == "gemini":
        from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider
        key = await get_app_setting("gemini_api_key")
        if key:
            return OpenAICompatibleProvider(
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=key,
                model=(await get_app_setting("gemini_model")) or "gemini-1.5-flash")
    # groq/openrouter legacy mapping similar — map to their OpenAI-compatible base URLs
    # groq: https://api.groq.com/openai/v1  | openrouter: https://openrouter.ai/api/v1
    return None
```

Keep `get_llm_provider()` (sync fallback) — extend similarly or leave as-is (low priority legacy path).

### File 6: Database Migration (NEW)

Add `packages/database/migrations/00XX_openai_compatible_llm.sql`:

```sql
INSERT INTO app_settings (key, value, is_encrypted, category) VALUES
  ('llm_base_url', 'https://openrouter.ai/api/v1', false, 'providers'),
  ('llm_api_key', '', true, 'api_keys'),
  ('llm_model', 'google/gemini-flash-1.5', false, 'providers'),
  ('llm_provider', 'openai_compatible', false, 'providers')
ON CONFLICT (key) DO NOTHING;
```

Run via `pnpm db:migrate`.

---

## Phase 3 — Settings UI (SEPARATE PR)

### File 7: `apps/web/src/app/(dashboard)/settings/page.tsx`

- Change `llm_provider` `<select>` to options: `openai_compatible` (OpenAI-Compatible Endpoint), `ollama` (Local Ollama Native).
- Add to `form` state: `llm_base_url`, `llm_api_key`, `llm_model`.
- Add "Endpoint Type" preset toggle that pre-fills `llm_base_url` + sets `llm_provider="openai_compatible"`:
  - Cloud/Direct → `https://openrouter.ai/api/v1`
  - Local Gateway → `http://localhost:20128/v1`
  - Local Hardware → `http://localhost:11434/v1`
- Add "Fetch Models" button → `GET /api/v1/settings/models` → populate `llm_model` dropdown.
- Remove per-vendor fields: `gemini_api_key`, `groq_api_key`, `openai_api_key` (replaced by single `llm_api_key`).
- Keep `ollama_base_url` / `ollama_model` for native-Ollama opt-in path.

### File 8: `apps/web/src/app/api/v1/settings/route.ts`

- Add `llm_base_url`, `llm_api_key`, `llm_model`, `llm_provider` to `SETTINGS_KEYS` and `ENCRYPTED_KEYS` (api_key only).
- Remove `gemini_api_key`, `groq_api_key`, `openai_api_key` from `SETTINGS_KEYS`/`ENCRYPTED_KEYS` (legacy keys still readable by Python factory, but UI shouldn't write them).

### File 9: `apps/web/src/app/api/v1/settings/models/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@aiva/database";

export async function GET() {
  const baseUrl = await getAppSetting("llm_base_url");
  const apiKey = await getAppSetting("llm_api_key");
  if (!baseUrl) return NextResponse.json({ models: [] });
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return NextResponse.json({ models: [] });
    const data = await res.json();
    return NextResponse.json({ models: (data.data ?? []).map((m: any) => m.id) });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
```

---

## Phase 4 — Cleanup (FOLLOW-UP PR, after verification)

- Delete `apps/workers/app/providers/llm/gemini_provider.py`
- Delete `apps/workers/app/providers/llm/groq_provider.py`
- Delete `apps/workers/app/providers/llm/openrouter_provider.py`
- Remove `google-generativeai` and `groq` from `apps/workers` deps (keep `openai`).
- After 2 releases: remove `_legacy_llm_config` from factory.py.
- Also delete dead provider stubs (Candidate 5): `search/brave_provider.py`, `image/sdxl_local_provider.py`, `tts/coqui_provider.py`, `tts/mock_provider.py`.

---

## Test Plan

| Test | File | Coverage |
|------|------|----------|
| `test_openai_compatible_provider.py` | `apps/workers/tests/` | Mock `AsyncOpenAI` (AsyncMock or respx). `generate_text`, `generate_json` (json_object + fallback retry), `generate_stream` (yields deltas), `list_models` (success + fallback). |
| `test_ollama_provider.py` | `apps/workers/tests/` | Regression: native `/api/generate` + `/api/tags`; new `generate_stream` + `list_models`. |
| `test_factory.py` | `apps/workers/tests/` | `llm_provider=openai_compatible` → `OpenAICompatibleProvider`; `llm_provider=ollama` → `OllamaProvider`; legacy key fallback logs warning. |
| `test_mock_provider.py` | `apps/workers/tests/` | `MockLLMProvider` implements all 4 methods. |
| E2E | `apps/workers/tests/e2e/` | Test Ollama container (or cassette) → `generate_json` with `SCRIPT_DIRECTOR_SCHEMA` → assert parsed `SceneDirection` list. |

Golden suite: `MockLLMProvider` already satisfies extended interface — no CI changes needed.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Exotic endpoint lacks `json_object` | `generate_json` retries with prompt-only enforcement; `LLMProviderError` on final parse failure (same as today). |
| Ollama `/v1` experimental gaps | Native `OllamaProvider` retained as opt-in; users switch `llm_provider` to `ollama` if needed. |
| Legacy deployments break on cutover | Backward-compat keys readable 2 releases with deprecation warning. |
| UI regression (missing model dropdown) | Phase 3 adds `list_models` fetch; Ollama path keeps `/api/tags` via `test-ollama` route. |

---

## Dependency Notes

- `openai` SDK already present in `apps/workers`. No new runtime deps.
- `google-generativeai` + `groq` become unused after Phase 4 (safe to remove then).
- Migration runs via `pnpm db:migrate` (ADR-005 unified runner).
