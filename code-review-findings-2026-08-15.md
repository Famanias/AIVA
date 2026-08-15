# AIVA Code Review Findings — Working V1 Assessment
**Date:** 2026-08-15  
**Branch:** `pivot-to-selfhosting-localfirst` (HEAD = `e94a063`)  
**Fixed Point:** `bbc82a1` (merge-base of prior review)  
**Review Scope:** Whether the codebase is a "working Version 1" — user inputs script/topic → backend processes → working MP4 export.

---

## Executive Summary

**Verdict: NOT yet a clean working V1, but the two worst prior blockers are fixed.**  
The codebase can now produce a multi-scene MP4 with narration, captions, ducked music, and single-scene audio re-render. Remaining gaps: (1) fresh clone requires manual LLM API key config, (2) Remotion renders one whole-timeline WebM (not per-scene parallel), (3) visual re-render re-uses existing overlay rather than re-rendering the changed scene's visuals.

---

## STANDARDS AXIS — Repo Coding Standards & Baseline Smells

### ✅ FIXED since prior review (`review-v1-verdict-wayfinder.md`, 2026-08-14)

| # | Finding (Prior) | Location | Status | Evidence |
|---|-----------------|----------|--------|----------|
| S1 | Auth removed from project creation — `SELECT id FROM auth.users LIMIT 1` with zero-UUID fallback | `apps/web/src/app/api/v1/projects/route.ts:30-38` | **FIXED** | Now calls `getAuthenticatedUser(req)` and returns 401 at lines 47-50. Same in `[id]/execute/route.ts`. |
| S2 | Dead duplicate line `agent = VoiceoverAgent(tts)` | `apps/workers/app/pipelines/stage_handlers.py:171-172` | **FIXED** | Only one occurrence now at line 175. |
| S3 | Certifier was a stub — raw SQL INSERTs, no real pipeline/FFmpeg | `scripts/certify_pipeline.ts` | **FIXED** | Now invokes `certifier_runner.py` → real TTS, CompositionEngine (FFmpeg), rerender; asserts `composition.mp4` + `subtitles.srt` on disk. |
| S4 | Master MP4 narrates only scene 1 audio | `VoiceoverHandler.ts:42`, `CompositionHandler.ts:40` | **FIXED** | `VoiceoverHandler` sets `audioUrl = master_audio_url` (stitched track); `CompositionHandler` reads `voice.master_audio_url` first. |

---

### ⚠️ JUDGEMENT CALLS (Baseline Smells — Not Hard Violations)

These are Fowler-style code smells from the baseline (Refactoring ch.3). They are **judgement calls**, not standard breaches. Repo standards override where documented.

| # | Smell | Location | Description | Recommended Fix |
|---|-------|----------|-------------|-----------------|
| J1 | **Primitive Obsession / Hardcoded Geometry** | `apps/workers/app/pipeline/rerender_scene.py:87-89` | `voice_id="en-US-AriaNeural"`, `9:16`/`1080x1920` hardcoded as defaults. `CompositionHandler` derives from `generationProfile.aspect_ratio` — re-render should too. | Read `generationProfile` from `state_payload` (already present at `route.ts:88-94`) and pass to rerender; remove hardcoded defaults. |
| J2 | **Print over Structured Logging** | `apps/workers/app/core/composition/engine.py:20,59`, `encoder.py:101`, `subtitle_generator.py` | Uses `print()` instead of `structlog` per AGENTS.md Logging convention. | Replace with `logger.info/warning` using existing `structlog.get_logger(__name__)`. |
| J3 | **FFmpeg Injection Surface** | `rerender_scene.py:293-296`, `stage_handlers.py:197-200` | Concat list file content built via string interpolation (`f"file '{safe_vf}'"`) with `-safe 0`. Paths are internally generated but pattern is fragile. | Use explicit arg-array for ffmpeg concat, or validate/escape paths; consider `subprocess.run` with list args only. |
| J4 | **Duplicated Code** | `certifier_runner.py:278-330` ≡ `stage_handlers.py:180-221` | Master voice concatenation logic duplicated. Also `apps/web/proxy.ts` ≡ `apps/web/src/middleware.ts` header injection; storage route stream wrapper duplicated. | Extract `concat_voice_tracks(files, output_path)` helper to shared module; deduplicate proxy/middleware. |
| J5 | **Silent Swallow / Fallback Without Log** | `apps/workers/app/providers/factory.py:54-57` | Unknown LLM provider falls back to `GeminiProvider(api_key="")` with no warning log (other call sites now log/rethrow). | Add `logger.warning("falling_back_to_empty_gemini", provider=provider_name)` before return. |
| J6 | **Unvalidated Range / NaN → 500** | `apps/web/src/app/api/v1/storage/[...path]/route.ts:43-45` | `parseInt` on garbage yields `NaN` → `createReadStream` throws 500; no 416 Range Not Satisfiable. | Validate range header, return 416 on invalid. |
| J7 | **Fire-and-Forget Rerender Route** | `apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts:44-55` | Returns `success` even if worker POST fails (catch logs warn but response is 200). | Await worker response; return worker status or 502 if worker unreachable. |
| J8 | **Divergent Change / Middle Man** | `factory.py:61-135` (`get_llm_provider` sync) | Sync `get_llm_provider`/`get_search_provider`/`get_tts_provider` have zero callers; async variants used everywhere. cwd-relative `../../storage` path guessing in `engine.py:50-52`, `checkpoint.py:12`. | Remove unused sync wrappers; centralize storage path resolution in `core/storage.py`. |
| J9 | **Speculative Generality** | `CompositionHandler.ts` | Builds full `CompositionModel` with `sfx_tracks: []`, `music_track` always present — some fields unused in current flow. | No action needed — future-proofing matches EDD; acceptable. |

---

## SPEC AXIS — Faithfulness to 4-Step V1 Definition & Wayfinder Tickets

### 4-Step V1 Definition (from your prompt)

| Step | Spec Requirement | Status | Details |
|------|------------------|--------|---------|
| **1** | Type topic OR paste script; pick format, length, persona, voice | ✅ **WORKING** | `InitializePipeline.tsx` collects all 6 fields → `POST /api/v1/projects` with `generationProfile` → enqueued. |
| **2** | AI drafts script + scene-by-scene breakdown tagged for stock/AI art | ⚠️ **PARTIAL** | `ScriptHandler.ts` → `handle_script_direction_stage` produces tagged scenes persisted to `public.scenes`/`scene_versions`. **BUT** default LLM provider (`factory.py:24`) = `openai_compatible` with **empty API key** — fresh clone cannot run script stage without manual Settings config. |
| **3** | Visuals, voiceover, timed captions, ducked music — all rendered in parallel | ⚠️ **PARTIAL** | Voiceover: parallel TTS via `asyncio.gather` ✅. Captions: real word timings → `.srt` + burned ✅. Music: `sidechaincompress` ducking engages ✅. **Visuals: Remotion renders ONE whole-timeline WebM** (`RenderHandler.ts:80` → `template-renderer`), not per-scene parallel clips. |
| **4** | Final MP4 assembled; tweak any scene on timeline → only that scene re-renders | ⚠️ **PARTIAL** | Master MP4 assembles all scenes' audio + overlay + ducked music ✅. Single-scene re-render re-synthesizes TTS, updates DB, re-stitches master ✅. **Visual re-render re-uses existing Remotion overlay** (no per-scene Remotion re-render). |

---

### Per-Ticket Verdict (Wayfinder `.scratch/v1-working-cut/issues/01…07`)

| Ticket | Title | Acceptance Criteria | Verdict | Gap |
|--------|-------|---------------------|---------|-----|
| **01** | Unify Database Layer & Pipeline Executor | AC1: `PipelineExecutor` uses `@aiva/database`; AC2: jobs/routes use local-PG; AC3: Supabase out of critical path; AC4: **Auth on project creation restored** | **PARTIAL** | AC1-3 ✅; **AC4 FAIL in prior review, NOW FIXED** — auth check present at `route.ts:47-50`. |
| **02** | Repair Monorepo Build & Shared Types | `prepare: tsc` in `shared-types`; Docker builds compile it | ✅ **PASS** | Verified: `packages/shared-types/package.json:14-15`, `web/Dockerfile:18`, `template-renderer/Dockerfile:37`. |
| **03** | Wire Brief Parameters & Custom Script Bypass | Custom script → `initialStep='script_direction'`; `generationProfile` flows through; `VoiceoverHandler` reads `voice_id` from profile; geometry from `aspect_ratio` | ⚠️ **PASS with caveat** | All ACs met. **Caveat:** Python `duration_target_minutes` stays `1` ignoring `duration_target_seconds` — cosmetic. |
| **04** | Persist Scenes & Asset Tagging | Scenes inserted to `public.scenes`/`scene_versions` with UUIDs, sequence, visual_type, FKs | ✅ **PASS** | `ScriptHandler.ts:77-124` inserts real rows; downstream handlers update `voiceover_url`, `word_timings`, `render_status`. |
| **05** | Parallel Scene Synthesis, Captions, Ducked Audio | AC1: Parallel TTS + assets; AC2: Real word timings → `.srt`; AC3: `sidechaincompress` ducking engages | ⚠️ **PARTIAL** | AC2-3 ✅. **AC1: Visuals are NOT per-scene parallel** — Remotion renders one whole-timeline clip. |
| **06** | True Single-Scene Re-render | AC1: Route updates `scene_versions`, queues worker; AC2: Re-synthesizes TTS + visual; AC3: Syncs checkpoints `03`/`04`; AC4: Re-stitches master | ⚠️ **PARTIAL** | AC1, AC3 ✅. **AC2: Re-synthesizes TTS only, not Remotion visual** (06_assets untouched). **AC4: Re-stitch now runs** (fallback `test_bg.mp4` generated at `rerender_scene.py:346`). |
| **07** | Clean-Clone End-to-End Verification | AC1: Topic brief E2E → `composition.mp4` + `subtitles.srt`; AC2: Custom script bypass; AC3: Single-scene re-render → updated MP4; AC4: Clean Docker build | ✅ **NOW PASS** | Certifier rewritten: invokes real TTS, FFmpeg, rerender; asserts files on disk. **Does not test UI→LLM→render** (manually inserts scenes, skips research/script). |

---

## ARCHITECTURAL FINDINGS (For Fix Prioritization)

### 1. Fresh-Clone LLM Default (Highest Impact)
**File:** `apps/workers/app/providers/factory.py:24,43-45`  
**Issue:** Default provider = `openai_compatible` with `api_key=""`. No auto-fallback to local Ollama when key empty.  
**Fix:** In `get_llm_provider_async()`, if `api_key` empty → auto-detect Ollama at `http://localhost:11434` and use `OllamaProvider` (already implemented at lines 26-39). This makes "type and go" work on a fresh clone with Ollama running.

### 2. Remotion Per-Scene Parallel Rendering
**Files:** `apps/web/src/services/pipeline/handlers/RenderHandler.ts`, `apps/template-renderer/src/render-server.ts`  
**Issue:** `RenderHandler` sends entire `PipelineIR` with all scenes → template-renderer produces **one WebM** for the whole timeline.  
**Fix:** Split into per-scene render jobs: `RenderHandler` iterates scenes, POSTs single-scene `PipelineIR` to template-renderer in parallel (via `Promise.all`), collects per-scene WebM URLs, then passes array to `CompositionHandler`. Requires `template-renderer` to accept single-scene IR (already supports `templateFamily` + one scene).

### 3. Visual Re-Render on Scene Edit
**Files:** `apps/workers/app/pipeline/rerender_scene.py`, `apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`  
**Issue:** Re-render re-synthesizes TTS + re-stitches master, but does **not** re-run Remotion for the changed scene's visuals.  
**Fix:** In `rerender_single_scene`, after TTS re-synthesis, POST single-scene `PipelineIR` to template-renderer for that scene's `visual_type`/`action`; update `scene.render_url`; then re-stitch. Reuses existing checkpoint/cache logic.

### 4. Duration Target Consistency
**Files:** `apps/web/src/app/api/v1/projects/route.ts:71`, `apps/workers/app/pipelines/stage_handlers.py:60,109`  
**Issue:** `duration_target_seconds` (30/60/90/180) sent from UI → `projects.duration_target_minutes = ceil(seconds/60)` → Python handlers still default `duration_target_minutes=1`.  
**Fix:** Pass `duration_target_seconds` through `generationProfile` to Python; use it in `ScriptDirectorAgent` for word-count/pacing.

---

## ACTIONABLE FIX LIST (Priority Order)

| Priority | ID | Description | Files to Change | Effort |
|----------|----|-------------|-----------------|--------|
| **P0** | F1 | Auto-fallback to Ollama when LLM API key empty (fresh-clone works) | `factory.py:22-54` | Low |
| **P0** | F2 | Fix fire-and-forget rerender route → await worker, return real status | `rerender/route.ts:44-63` | Low |
| **P0** | F3 | Validate range header in storage route → 416 on NaN/invalid | `storage/[...path]/route.ts:43-45` | Low |
| **P1** | F4 | Remove hardcoded geometry in `rerender_scene.py` → read from `generationProfile` | `rerender_scene.py:87-105`, `route.ts:88-94` | Medium |
| **P1** | F5 | Replace `print()` with `structlog` in composition engine | `engine.py`, `encoder.py`, `subtitle_generator.py` | Low |
| **P1** | F6 | Deduplicate master voice concat logic → shared helper | `stage_handlers.py:180-221`, `certifier_runner.py:278-330` | Medium |
| **P2** | F7 | Per-scene parallel Remotion rendering (split `RenderHandler` → parallel jobs) | `RenderHandler.ts`, `template-renderer/src/render-server.ts` | High |
| **P2** | F8 | Visual re-render on scene edit (POST single-scene IR to template-renderer) | `rerender_scene.py:199-387`, `render-server.ts` | High |
| **P3** | F9 | Sync `duration_target_seconds` through to Python script director | `route.ts:88-94`, `stage_handlers.py:60,109`, `script_director_agent.py` | Medium |
| **P3** | F10 | Remove unused sync provider wrappers (`get_llm_provider`, etc.) | `factory.py:92-189` | Low |
| **P3** | F11 | Centralize storage path resolution (remove cwd-relative `../../storage`) | `engine.py:50-52`, `checkpoint.py:12`, `core/storage.py` | Low |

---

## VERIFICATION COMMANDS (For Agent Implementing Fixes)

```bash
# 1. Build check (must pass)
pnpm build

# 2. TypeScript typecheck (must pass)
pnpm --filter web exec tsc --noEmit

# 3. Python tests (must pass)
cd apps/workers && venv\Scripts\python -m pytest tests/ -v

# 4. Pipeline certifier (must produce composition.mp4 + subtitles.srt)
pnpm certify
# or
pnpm test:pipeline
# Check .artifacts/validation_report.md

# 5. Fresh clone simulation (after F1)
# - Delete .env or set empty LLM keys
# - Run: pnpm services:up && pnpm dev
# - Create project via UI with topic "test" → should complete with Ollama

# 6. Single-scene re-render test
# - Create project, let it complete
# - Go to /projects/{id}/timeline, edit scene 1 script, click Re-render
# - Verify: TTS re-synthesized, master MP4 updated, visual re-rendered (after F8)
```

---

## RELATED DOCUMENTS
- Prior review: `review-v1-verdict-wayfinder.md` (2026-08-14)
- Architecture: `ARCHITECTURE.md`, `docs/EDD.md`
- Spec: `.scratch/v1-working-cut/map.md` + `issues/01…07`
- Standards: `AGENTS.md` (root), `AGENTS.md` (apps/web)
- Walkthrough: `walkthrough.md` (UI redesign details)

---

*End of findings. This file is intended for a follow-up implementation agent to consume and act upon.*