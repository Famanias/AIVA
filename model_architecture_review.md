# Architecture Review: OmniRoute and Local Model Integration

## 1. Executive Summary

This document evaluates the proposal to transition AIVA's AI model architecture from direct, individual provider integrations to a centralized gateway model using **OmniRoute** and native local models (**Ollama / llama.cpp**). 

**Recommendation:** We should adopt **Option D (Unified Runtime through OpenAI-Compatible Interface)**, leveraging OmniRoute for users who want complex provider routing, while maintaining a generic "OpenAI-Compatible" provider in our codebase. This eliminates the need for provider-specific SDKs (Gemini, Groq, etc.) while allowing users to point AIVA at *any* compliant endpoint—whether that is a local OmniRoute instance, a local Ollama daemon, or directly to OpenRouter.

For local models, **Ollama** is highly recommended over raw llama.cpp for application integration, as it provides the necessary daemon lifecycle and API layer out-of-the-box.

---

## 2. Current Architecture

Currently, AIVA's backend (Python workers) implements LLM integration via an abstract interface: `ILLMProvider` (`app/providers/llm/base.py`).

- **Implementations:** `GeminiProvider`, `GroqProvider`, `OpenRouterProvider`, and `OllamaProvider`.
- **Factory:** `app/providers/factory.py` reads `settings.llm_provider` and instantiates the specific class.
- **Dependencies:** The application requires specific SDKs for each provider (e.g., `google-generativeai`, `groq`).
- **Configuration:** Users must configure `GEMINI_API_KEY`, `GROQ_API_KEY`, etc., in `.env` or the database.

## 3. Problems With the Current Approach

1. **Maintenance Burden:** Every new provider requires a new class implementation, new environment variables, and new SDK dependencies.
2. **Duplicated Logic:** Error handling, retries, and JSON parsing must be handled per-provider.
3. **UI Complexity:** The frontend settings UI must dynamically render different fields for different providers.
4. **No Fallbacks:** If Groq rate-limits the user, the pipeline fails. We have no mechanism to fallback to Gemini.
5. **No Streaming:** The current `ILLMProvider` interface only supports blocking `generate_text` and `generate_json`.

---

## 4. OmniRoute Research Findings

**OmniRoute** is an open-source, self-hosted AI gateway that unifies multiple LLM providers behind a single OpenAI-compatible endpoint (typically `http://localhost:20128/v1`).

- **Routing & Fallbacks ("Combos"):** It excels at automatic fallbacks. If a primary provider hits a rate limit, OmniRoute seamlessly routes the request to a secondary provider.
- **API Compatibility:** It fully mimics the OpenAI API format.
- **Local Model Support:** It can route requests to local servers like Ollama or LMStudio.
- **Deployment:** It runs as an independent daemon (Node/npm or Docker).

**Drawbacks:** It adds a mandatory external dependency to the stack. If a user *only* wants to use OpenRouter, forcing them to install and configure OmniRoute locally is unnecessary friction.

---

## 5. Ollama vs llama.cpp Evaluation

When considering local models, the choice is between Ollama and llama.cpp.

| Feature | llama.cpp | Ollama |
| :--- | :--- | :--- |
| **Identity** | C/C++ bare-metal inference engine | High-level Go daemon wrapping llama.cpp |
| **Management** | Manual (downloading GGUF files) | Automatic (Docker-like `ollama run llama3`) |
| **API** | Basic HTTP server included, but manual | Robust, OpenAI-compatible daemon API |

**Verdict: Ollama is the correct choice.** 
While llama.cpp offers absolute maximum bare-metal control, AIVA needs a reliable REST API and automated model management. Ollama abstracts away the pain of GGUF tensor compilation while only sacrificing ~2-5% overhead. Crucially, Ollama exposes an OpenAI-compatible endpoint out of the box (`http://localhost:11434/v1`).

---

## 6. Architecture Options

### Option A — Direct Provider Integrations (Status Quo)
* **Pros:** No external dependencies required.
* **Cons:** High maintenance burden, tightly coupled UI/backend, brittle (no fallbacks).

### Option B — OmniRoute-Centric
* **Pros:** Incredible fallback logic, token compression, removes all SDKs from AIVA.
* **Cons:** Forces *every* user to install and configure a 3rd party routing gateway just to use the app.

### Option C — OmniRoute + Native Local Runtime
* **Pros:** Good separation of cloud vs local.
* **Cons:** We still have to manage two different connection paths in AIVA.

### Option D — Unified Runtime Through OpenAI-Compatible Interface (Recommended)
Because Groq, OpenRouter, OmniRoute, and Ollama *all* support the standard OpenAI API specification, we can replace our entire `ILLMProvider` implementation suite with a single `OpenAICompatibleProvider`.

Users simply provide:
1. `Base URL`
2. `API Key`
3. `Model Name`

If they want OmniRoute, they point the Base URL to `http://localhost:20128/v1`. If they want Ollama, they point to `http://localhost:11434/v1`. If they want pure OpenRouter without a local gateway, they point to `https://openrouter.ai/api/v1`.

---

## 7. Recommended Architecture

Adopt **Option D**. 

We do not need to strictly couple AIVA to OmniRoute. Instead, we adapt AIVA to speak exclusively in the OpenAI API dialect. This allows users to use OmniRoute if they want advanced fallback routing, but doesn't force them into it.

**Why?**
1. **Zero Provider SDKs:** We can uninstall `google-generativeai`, `groq`, etc. We only need the official `openai` Python package.
2. **Infinite Flexibility:** Any new provider that supports the OpenAI spec (which is almost all of them) works instantly without code changes.
3. **OmniRoute / Ollama Native:** Both act as OpenAI proxies. AIVA connects to them seamlessly.

---

## 8. Proposed Frontend Settings Architecture

The settings UI should pivot from asking "Which provider?" to asking "Configure your OpenAI-Compatible Endpoint".

**UI Structure:**
- **Endpoint Type Toggle:** 
  - `[ Cloud / Direct (OpenRouter, Groq) ]`
  - `[ Local Gateway (OmniRoute) ]`
  - `[ Local Hardware (Ollama) ]`
*(Note: These are just UI presets that pre-fill the Base URL).*

- **Configuration Fields:**
  - **Base URL:** (e.g., `http://localhost:11434/v1` for Ollama)
  - **API Key:** (Hidden for local Ollama, required for Cloud/OmniRoute)
  - **Model Name:** Text input with an auto-fetch dropdown.

**Model Discovery:** 
Because we are using the standard OpenAI spec, the frontend can query `GET {Base URL}/models` to dynamically populate the model dropdown, whether it's querying Ollama's local registry, OmniRoute's config, or OpenRouter's cloud.

---

## 9. Proposed Backend Architecture

1. **Delete** `GeminiProvider`, `GroqProvider`, etc.
2. **Create** `OpenAIProvider(ILLMProvider)` using the standard `openai` Async Python client.
3. **Factory Update:** `get_llm_provider_async()` simply reads the generic `llm_base_url` and `llm_api_key` from the database and initializes the `OpenAIProvider`.

---

## 10. Model Discovery and Selection Flow

1. User enters Base URL and API Key in Frontend Settings.
2. User clicks "Fetch Models".
3. Frontend hits Next.js API route `GET /api/v1/settings/models`.
4. Next.js API proxies the request to the configured Base URL's `/models` endpoint using the provided API Key.
5. User selects a model from the dropdown -> Saves to Database.

---

## 11. Credential and Security Strategy

- **Database:** The `llm_api_key` remains stored in the PostgreSQL `app_settings` table, AES-256 encrypted at rest by the `DATABASE_ENCRYPTION_KEY`.
- **Delegation:** By moving to OmniRoute for power users, AIVA holds fewer credentials. AIVA only holds the OmniRoute API key; OmniRoute holds the keys to Groq, Gemini, etc. This is a massive security win.

---

## 12. Streaming / Error / Fallback Strategy

- **Streaming:** The new `OpenAIProvider` should add a `generate_stream()` method utilizing Server-Sent Events (SSE). 
- **Fallbacks:** AIVA will **not** handle fallbacks. This logic is complex. We delegate fallback logic entirely to OmniRoute. If a user wants fallbacks, they use OmniRoute. If they don't, AIVA just throws a standard error if OpenRouter fails.

---

## 13. Migration Strategy

1. Add `OpenAIProvider` alongside existing providers.
2. Add `llm_base_url`, `llm_api_key` to `app_settings`.
3. Update Frontend to allow generic OpenAI endpoint configuration.
4. Set default Base URL to OpenRouter (to preserve current behavior).
5. Deprecate and remove legacy provider SDKs.

---

## 14. Risks and Tradeoffs

- **Risk:** Some providers (like older Gemini APIs or Anthropic) have slight quirks when mapped to the OpenAI spec. We will rely on tools like OpenRouter or OmniRoute to translate perfectly.
- **Tradeoff:** We lose native SDK features specific to one provider (like Gemini's native function calling vs OpenAI's tool calling), forcing us to adhere strictly to the lowest common denominator (OpenAI spec).

---

## 15. Files/Components That Would Need Changes

- **Backend:** 
  - `apps/workers/app/providers/llm/base.py` (Add streaming)
  - `apps/workers/app/providers/llm/openai_provider.py` (NEW)
  - `apps/workers/app/providers/factory.py` (Refactor to use new provider)
  - Delete `gemini_provider.py`, `groq_provider.py`, etc.
- **Frontend:**
  - `apps/web/src/app/settings/page.tsx` (Refactor LLM section)
  - `apps/web/src/app/api/v1/settings/route.ts`
- **Database:**
  - Seed and migration files to add the generic keys.

---

## 16. Implementation Phases

- **Phase 1:** Implement the `OpenAIProvider` in Python and wire it up to `factory.py` using fallback env vars.
- **Phase 2:** Update the database schema to support generic `llm_base_url`.
- **Phase 3:** Redesign the Settings UI to support the "OpenAI-Compatible" preset approach and dynamic model fetching.
- **Phase 4:** Remove old provider code and SDKs.

---

## 17. Open Questions / Decisions Requiring My Approval

1. **OmniRoute Requirement:** Do we agree that OmniRoute should remain *optional* (accessed via the generic Base URL) rather than a *hard requirement* to run AIVA?
2. **Provider Purge:** Are you comfortable completely dropping the native Google `google-generativeai` SDK and relying entirely on the OpenAI spec wrapper (via OpenRouter/OmniRoute)?
3. **Structured Output (JSON):** OpenAI's `response_format={ "type": "json_object" }` is widely supported, but true structured outputs (JSON Schema enforcing) varies by provider. Are we okay with relying on prompt engineering + standard JSON parsing if the generic endpoint drops schema enforcement?
