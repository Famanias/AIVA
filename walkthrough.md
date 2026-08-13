# Walkthrough — Working Version 1 Release Execution

This document details the step-by-step implementation, files modified, automated verification results, and manual QA instructions for each phase of the working V1 release plan.

---

## Phase 1: Secret & Database Infrastructure Harmonization

### What Was Implemented
1. **Master Secret Harmonization (`apps/workers/app/core/db.py` & `packages/database/src/crypto.ts`)**:
   - Standardized default master fallback secret across TypeScript (`crypto.ts`) and Python (`db.py`) to `aiva_default_local_master_secret_2026`.
   - Fixed silent error swallowing in `crypto.ts` by adding explicit error logging when decryption fails.

2. **Docker Compose & Environment Secret Propagation (`infra/docker-compose.yml` & `.env.example`)**:
   - Explicitly injected `APP_SECRET` (`aiva_default_local_master_secret_2026`) and `DATABASE_URL` (`postgresql://postgres:postgres@postgres:5432/aiva`) into container environment definitions for `workers`, `template-renderer`, and `web`.
   - Updated `.env.example` to document `APP_SECRET` and `DATABASE_URL`.

3. **Decoupled QueueControlService from Cloud Supabase (`apps/web/src/services/queue.control.service.ts`)**:
   - Replaced cloud `supabase-js` SDK client initialization (`createClient(...)`) with direct PostgreSQL queries via `@aiva/database` `query()`.
   - Enables local job cancellation, pausing, and resuming without requiring cloud Supabase instances.

---

### Files & Components Changed
- `[MODIFY]` [`apps/workers/app/core/db.py`](file:///d:/repos/AIVA/apps/workers/app/core/db.py) — Harmonized fallback master secret string.
- `[MODIFY]` [`packages/database/src/crypto.ts`](file:///d:/repos/AIVA/packages/database/src/crypto.ts) — Added explicit error logging for secret decryption failures.
- `[MODIFY]` [`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml) — Injected `APP_SECRET` and `DATABASE_URL` across all container services.
- `[MODIFY]` [`.env.example`](file:///d:/repos/AIVA/.env.example) — Documented `APP_SECRET` and `DATABASE_URL`.
- `[MODIFY]` [`apps/web/src/services/queue.control.service.ts`](file:///d:/repos/AIVA/apps/web/src/services/queue.control.service.ts) — Migrated from cloud `supabase-js` to `@aiva/database` `query()` client.

---

### Automated Verification Performed

1. **Database & Crypto Unit Tests**:
   ```bash
   pnpm --filter @aiva/database test
   ```
   **Result:** ✅ PASSED (AES-256-GCM encryption & decryption roundtrip verified with matching fallback key).

2. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

3. **Python Worker Unit Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 0.28s).

---

### Manual QA Instructions

To manually verify Phase 1 on your machine, follow these steps:

#### Step 1: Start Container Infrastructure
Run:
```powershell
docker-compose -f infra/docker-compose.yml up postgres redis -d
```

#### Step 2: Verify Master Secret Resolution in Python
Run Python one-liner to verify master secret lookup:
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python.exe -c "from app.core.db import decrypt_secret; print('Python decrypt ready')"
```
**Expected Output:** Prints `Python decrypt ready` with no encryption key mismatch warnings.

#### Step 3: Run Database Unit Tests
```powershell
pnpm --filter @aiva/database test
```
**Expected Output:** Output confirms `✓ Crypto roundtrip test passed!`.

---

## Phase 2: Real Provider Wiring & In-App Settings Integration

### What Was Implemented
1. **Dynamic Provider Wiring in Python Stage Handlers (`apps/workers/app/pipelines/stage_handlers.py`)**:
   - Replaced synchronous legacy provider getters with `await get_llm_provider_async()`, `await get_search_provider_async()`, and `await get_tts_provider_async()`.
   - Pipeline stages (`handle_research_stage`, `handle_outline_stage`, `handle_script_direction_stage`, `handle_voiceover_stage`) now consume dynamic, decrypted credentials saved in PostgreSQL `app_settings`.

2. **Decrypted App Settings Resolution in Provider Factory (`apps/workers/app/providers/factory.py`)**:
   - Updated `get_llm_provider_async()`, `get_search_provider_async()`, `get_tts_provider_async()`, `get_stock_provider_async()`, and `get_image_provider_async()`.
   - Correctly maps provider selections (`gemini`, `groq`, `openrouter`, `ollama`) to their respective decrypted API keys and model configurations in PostgreSQL.

3. **URL Sanitization & SSRF Protection in Ollama API (`apps/web/src/app/api/v1/settings/test-ollama/route.ts`)**:
   - Added URL syntax parsing and protocol restriction (`http:`, `https:`) before making server-side healthcheck calls.

---

### Files & Components Changed
- `[MODIFY]` [`apps/workers/app/providers/factory.py`](file:///d:/repos/AIVA/apps/workers/app/providers/factory.py) — Updated async provider factories to query decrypted PostgreSQL `app_settings`.
- `[MODIFY]` [`apps/workers/app/pipelines/stage_handlers.py`](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py) — Updated stage handlers to await async provider instances.
- `[MODIFY]` [`apps/web/src/app/api/v1/settings/test-ollama/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/test-ollama/route.ts) — Added URL validation and protocol restrictions.

---

### Automated Verification Performed

1. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

2. **Python Worker Unit Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 0.28s).

---

### Manual QA Instructions

To manually verify Phase 2 on your machine, follow these steps:

#### Step 1: Start Container Infrastructure & Web Dev Server
Run:
```powershell
docker-compose -f infra/docker-compose.yml up postgres redis -d
pnpm --filter web dev
```

#### Step 2: Test Provider Selection & Async Lookup in Python
Open PowerShell and run Python test script verifying dynamic provider resolution from PostgreSQL `app_settings`:
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python.exe -c "import asyncio; from app.providers.factory import get_llm_provider_async; provider = asyncio.run(get_llm_provider_async()); print('Loaded provider:', type(provider).__name__)"
```
**Expected Output:** Prints `Loaded provider: GeminiProvider` (or your active selection from `app_settings`).

#### Step 3: Test Ollama Base URL Validation
Visit `http://localhost:3000/settings` in your browser, enter `http://localhost:11434` into Ollama Base URL, and click **Test Connection**.
**Expected Result:** Connected badge displays installed Ollama models, or returns informative error without throwing server crashes.

---

## Phase 3: Brief Creation Form Expansion & Route Collision Cleanup

### What Was Implemented
1. **Next.js Parallel Route Collision Cleanup (`apps/web/src/app/projects`)**:
   - Removed redundant legacy directory `apps/web/src/app/projects/[id]` which conflicted with self-hosted route group `apps/web/src/app/(dashboard)/projects/[id]`.

2. **Expanded Video Brief Creation Form (`apps/web/src/app/page.tsx`)**:
   - Upgraded home page creation widget (`InitializePipeline`) with full Phase 1/Phase 2 brief controls:
     - **Input Mode Selector:** AI Topic Research vs Custom Script Paste.
     - **Format & Aspect Ratio:** Vertical 9:16 Shorts/Reels vs Horizontal 16:9 YouTube.
     - **Target Duration:** 30s (Quick Hook), 60s (Standard Short), 90s, 180s (3 Minutes).
     - **Template Style:** Stickman Animation vs Ken-Burns Documentary.
     - **Voice Selection:** `en-US-AriaNeural`, `en-US-GuyNeural`, `en-GB-SoniaNeural`, `en-AU-Neural`.
     - **Persona / Tone:** Informative, Dramatic, Energetic, Humorous.

3. **Updated POST `/api/v1/projects` Endpoint (`apps/web/src/app/api/v1/projects/route.ts`)**:
   - Migrated from cloud Supabase SDK client to direct PostgreSQL `@aiva/database` queries.
   - Saves `input_mode`, `custom_script`, `aspect_ratio`, `voice_id`, and `persona` into `jobs.state_payload` JSON field for worker consumption.

---

### Files & Components Changed
- `[DELETE]` [`apps/web/src/app/projects/[id]/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/projects/%5Bid%5D/page.tsx) — Removed legacy route group collision file.
- `[MODIFY]` [`apps/web/src/app/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/page.tsx) — Added brief parameters to `InitializePipeline` component.
- `[MODIFY]` [`apps/web/src/app/api/v1/projects/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts) — Updated project submission API route to query local PostgreSQL and save `state_payload`.

---

### Automated Verification Performed

1. **Next.js Production Build & Type Checking**:
   ```bash
   pnpm --filter web build
   ```
   **Result:** ✅ PASSED (`Finished TypeScript in 5.0s`, `100% static & dynamic page generation`).

2. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

---

### Manual QA Instructions

To manually verify Phase 3 on your machine, follow these steps:

#### Step 1: Launch Next.js Web Application
Run:
```powershell
pnpm --filter web dev
```

#### Step 2: Test Brief Creation Form & Custom Script Paste
1. Open `http://localhost:3000` in your browser.
2. Toggle **Input Mode** to **Custom Script Paste**.
3. Paste a test script segment, select **Vertical 9:16 (Shorts/Reels)**, **60 Seconds**, and click **Start Pipeline Generation**.
4. **Expected Result:** Browser redirects smoothly to `/projects/{id}` dashboard without 404 or parallel route collision errors.

---

## Phase 4: Composition Output Persistence & Subtitle Export

### What Was Implemented
1. **Persistent Media & Subtitle Exporter in Workers (`apps/workers/app/core/composition/engine.py` & `subtitle_generator.py`)**:
   - Added `SubtitleGenerator.generate_srt()` to convert scene word timings into standard `.srt` format.
   - Updated `CompositionEngine.run()` to copy rendered video output (`master_{job_id}.mp4`) to `./storage/projects/{project_id}/composition.mp4` and output `./storage/projects/{project_id}/subtitles.srt`.

2. **Storage Endpoint MIME Type Mapping (`apps/web/src/app/api/v1/storage/[...path]/route.ts`)**:
   - Added `.srt` MIME type (`application/x-subrip`) to storage route handler.
   - Enforces `Content-Disposition: attachment; filename="subtitles.srt"` when `?download=true` query parameter is present.

---

### Files & Components Changed
- `[MODIFY]` [`apps/workers/app/core/composition/subtitle_generator.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/subtitle_generator.py) — Added `generate_srt()` formatting.
- `[MODIFY]` [`apps/workers/app/core/composition/engine.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/engine.py) — Persisted `composition.mp4` and `subtitles.srt` into `./storage/projects/{project_id}/`.
- `[MODIFY]` [`apps/web/src/app/api/v1/storage/[...path]/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/%5B...path%5D/route.ts) — Added `.srt` mime-type mapping for file downloads.

---

### Automated Verification Performed

1. **Web Storage & Download Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED (`Storage download attachment header test passed!`).

2. **Python Composition & Worker Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 0.55s).

---

### Manual QA Instructions

To manually verify Phase 4 on your machine, follow these steps:

#### Step 1: Run Test Composition Copy
Open PowerShell and verify storage persistence logic:
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python.exe -c "from app.core.composition.subtitle_generator import SubtitleGenerator; print(SubtitleGenerator.generate_srt([{'word':'Test','start':0,'end':1}], 'storage/projects/test-proj/subtitles.srt'))"
```
**Expected Output:** Prints `[SubtitleGenerator] Generated SRT subtitle file at storage/projects/test-proj/subtitles.srt`.

#### Step 2: Test Subtitle Download API
Visit `http://localhost:3000/api/v1/storage/projects/test-proj/subtitles.srt?download=true` in your browser.
**Expected Result:** Browser triggers a file download containing the `.srt` subtitle content.

---

## Phase 5: Scene Re-rendering Infrastructure & Queue Listener Wiring

### What Was Implemented
1. **Scene Re-rendering Worker Endpoint (`apps/workers/app/routers/pipeline.py`)**:
   - Added `/pipeline/rerender_scene` POST endpoint to Python worker API.
   - Delegates request parameters (`project_id`, `scene_id`, `revision`) to `rerender_single_scene()`, updating PostgreSQL `scenes` and `scene_versions` checkpoint state.

2. **Web API Worker Dispatch (`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`)**:
   - Updated scene rerender endpoint to update `scene_versions` in PostgreSQL and trigger worker re-render execution via `WORKER_API_URL`.

---

### Files & Components Changed
- `[MODIFY]` [`apps/workers/app/routers/pipeline.py`](file:///d:/repos/AIVA/apps/workers/app/routers/pipeline.py) — Added `SceneRerenderRequest` and `/rerender_scene` route.
- `[MODIFY]` [`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/scenes/%5Bscene_id%5D/rerender/route.ts) — Added async worker API dispatch call.

---

### Automated Verification Performed

1. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

2. **Python Worker Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 0.34s).

---

### Manual QA Instructions

To manually verify Phase 5 on your machine, follow these steps:

#### Step 1: Start Python Workers & Web Server
Run:
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

#### Step 2: Trigger Scene Re-rendering API
Send a POST request to trigger scene re-rendering:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/pipeline/rerender_scene" -Method POST -ContentType "application/json" -Body '{"trace_id":"00000000-0000-0000-0000-000000000001","project_id":"00000000-0000-0000-0000-000000000001","scene_id":"00000000-0000-0000-0000-000000000002","revision":1}'
```
**Expected Result:** Returns `{"status":"success","data":{...}}` with updated scene status.




