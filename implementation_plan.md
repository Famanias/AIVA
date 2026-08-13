# Implementation Plan — Achieving a Working Version 1 MVP

This implementation plan directly addresses all hard standards violations, spec gaps, and broken workflows identified in `review-v1-verdict.md`. It outlines the exact engineering steps required to ensure that a user who clones this repository can run the platform out-of-the-box and generate, edit, and download completed videos.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Corrective Decisions:**
> 1. **Complete Decoupling from Supabase Cloud:** Replace all residual `@supabase/supabase-js` database/auth calls in `apps/web` (project creation, status updates, queue control) with direct PostgreSQL queries via `@aiva/database`.
> 2. **Provider Settings Wiring:** Update worker pipeline `stage_handlers.py` to consume dynamic, decrypted credentials from `app_settings` in PostgreSQL via `get_*_provider_async()`, ensuring user edits in `/settings` drive video generation.
> 3. **Output File Persistence:** Ensure the worker composition engine saves rendered videos directly to `./storage/projects/{id}/composition.mp4` and subtitles to `./storage/projects/{id}/subtitles.srt`, fixing 404 download errors.
> 4. **Wired Single-Scene Re-Rendering:** Connect the Timeline Studio `/api/v1/projects/[id]/scenes/[scene_id]/rerender` API route to a worker task that regenerates the scene audio/visual assets and re-stitches `composition.mp4` with FFmpeg.
> 5. **Docker Build Fixes:** Fix `apps/workers/Dockerfile` entrypoint (`app.main:app`), Next.js multi-stage monorepo build in `apps/web/Dockerfile`, and cross-service `APP_SECRET` harmonization in `docker-compose.yml`.

---

## Open Questions

> [!NOTE]
> None. All corrective actions are derived directly from empirical codebase verification of `review-v1-verdict.md`.

---

## Proposed Changes

### Phase 1: Secret & Database Infrastructure Harmonization

#### [MODIFY] [crypto.ts](file:///d:/repos/AIVA/packages/database/src/crypto.ts) & [db.py](file:///d:/repos/AIVA/apps/workers/app/core/db.py)
- Standardize default fallback master secret across TS and Python to `aiva_default_local_master_secret_2026`.
- Remove silent passthrough of invalid ciphertexts in `crypto.ts`; log error and throw explicit exceptions on decryption failure.

#### [MODIFY] [docker-compose.yml](file:///d:/repos/AIVA/infra/docker-compose.yml) & [.env.example](file:///d:/repos/AIVA/.env.example)
- Pass `APP_SECRET` and `DATABASE_URL` explicitly to `web`, `workers`, and `template-renderer` services.
- Update `.env.example` and `SETUP.md` to document `APP_SECRET`.

#### [MODIFY] [apps/web project creation & queue control services]
- Replace `supabase-js` client in `apps/web` with `@aiva/database` `query()` calls for project insertion and job status updates.

---

### Phase 2: Real Provider Wiring & In-App Settings Integration

#### [MODIFY] [stage_handlers.py](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py) & [factory.py](file:///d:/repos/AIVA/apps/workers/app/providers/factory.py)
- Update `stage_handlers.py` to use `await get_llm_provider_async()`, `await get_tts_provider_async()`, `await get_search_provider_async()`, `await get_image_provider_async()`, and `await get_broll_provider_async()`.
- Ensure provider factories query and decrypt credentials from PostgreSQL `app_settings` table at runtime.

#### [MODIFY] [test-ollama/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/test-ollama/route.ts)
- Add URL parsing and hostname validation to sanitize user-provided Ollama base URLs before issuing server-side HTTP checks.

---

### Phase 3: Brief Creation Form Expansion & Route Collision Cleanup

#### [DELETE] [apps/web/src/app/projects/[id]/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/projects/%5Bid%5D/page.tsx)
- Remove duplicate route file to resolve Next.js route collision with `apps/web/src/app/(dashboard)/projects/[id]/page.tsx`.

#### [MODIFY] [apps/web/src/app/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/page.tsx)
- Expand Home Page Brief Creation form:
  - Input mode toggle: Topic Input vs Custom Script Paste.
  - Video Aspect Ratio / Format: Vertical 9:16 Shorts vs Horizontal 16:9 YouTube.
  - Duration Target: 30s, 60s, 90s, 180s.
  - Voice Selection dropdown (e.g. `en-US-AriaNeural`, `en-US-GuyNeural`).
  - Tone / Persona selection (Informative, Dramatic, Energetic).
- Save selected options into `projects` and `generation_profiles` tables in PostgreSQL.

---

### Phase 4: Composition Output Persistence, Audio Ducking & Subtitles

#### [MODIFY] [engine.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/engine.py) & [CompositionHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts)
- After FFmpeg composition completes, copy/persist final video to `./storage/projects/{id}/composition.mp4`.
- Generate and save SRT subtitle file to `./storage/projects/{id}/subtitles.srt`.
- Wire background music track selection and sidechain compression ducking parameters in `engine.py`.
- Ensure Faster-Whisper provider returns word-level timestamps, falling back to estimated word timings if local Whisper weights are unpopulated.

---

### Phase 5: End-to-End Single-Scene Partial Re-Rendering Pipeline

#### [MODIFY] [rerender/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts) & [rerender_scene.py](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py)
- Wire `POST /api/v1/projects/[id]/scenes/[scene_id]/rerender` to enqueue a background job.
- Implement python worker consumer for single-scene re-rendering:
  1. Re-generate TTS audio for modified scene.
  2. Fetch/generate new visual asset for scene.
  3. Render Remotion VP9 clip for modified scene.
  4. Invoke FFmpeg to re-stitch `composition.mp4` by combining new scene clip with unchanged cached scene clips.
  5. Update PostgreSQL scene status to `completed`.

#### [MODIFY] [page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx)
- Add polling/event listener on Timeline Studio page to auto-refresh player when single-scene re-rendering completes.

---

### Phase 6: Production Dockerization Fixes & Fresh-Clone Certification

#### [MODIFY] [Dockerfile](file:///d:/repos/AIVA/apps/workers/Dockerfile)
- Update entrypoint CMD to `["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.

#### [MODIFY] [Dockerfile](file:///d:/repos/AIVA/apps/web/Dockerfile)
- Configure complete pnpm monorepo multi-stage build:
  - Install dependencies (`pnpm install`).
  - Build `@aiva/database` and `apps/web` (`pnpm build`).
  - Run production server (`pnpm start`).

#### [NEW] [certify_v1.ts](file:///d:/repos/AIVA/scripts/certify_v1.ts)
- Create comprehensive V1 verification script:
  - Submits a brief (topic + custom script).
  - Runs full worker agent chain & FFmpeg composition.
  - Verifies `./storage/projects/{id}/composition.mp4` exists and is non-empty.
  - Triggers single-scene re-rendering and verifies updated composition file.

---

## Verification Plan

### Automated Tests
1. **Workspace Build & Type Check:**
   ```bash
   pnpm build && pnpm type-check
   ```
2. **Worker Pytest Suite:**
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests
   ```
3. **Full V1 End-to-End Certification:**
   ```bash
   pnpm tsx scripts/certify_v1.ts
   ```

### Manual Verification
1. `docker-compose -f infra/docker-compose.yml up --build`
2. Open `http://localhost:3000` — submit brief with custom script paste & voice selection.
3. Observe live job progress → verify video generates and plays in player on `/projects/[id]`.
4. Click **"Download MP4"** → verify file downloads.
5. Go to Timeline Studio (`/projects/[id]/timeline`), edit Scene #1, click **"Save & Re-render"** → verify only Scene #1 re-renders and output video updates.
