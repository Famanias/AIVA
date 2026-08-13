# Implementation Plan — AIVA Working Version 1 (V1 Working Cut)

This implementation plan defines the complete, milestone-by-milestone engineering work to resolve all 7 tickets in [`.scratch/v1-working-cut/issues/`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/) and deliver a verified, fresh-clone operable Version 1 of AIVA.

---

## User Review Required

> [!IMPORTANT]
> - **Milestone 1** removes `@supabase/supabase-js` from [`PipelineExecutor.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineExecutor.ts), `jobs/*` API routes, and event loggers, standardizing 100% on direct `@aiva/database` (`pg.Pool`) queries.
> - **Milestone 3** enables custom script bypass: when `input_mode === 'custom_script'`, the pipeline skips `research` and `outline` and starts directly at `script_direction`.
> - **Milestone 5** introduces parallel scene generation using `asyncio.gather` for per-scene TTS, stock/SDXL asset download, and Remotion scene clip rendering, alongside real word timings and background music auto-ducking (`sidechaincompress`).
> - **Milestone 6** upgrades single-scene re-render from a metadata status flip to true asset re-generation and selective FFmpeg master re-composition.

---

## Open Questions

None — all architectural decisions were grilled and approved in Round 1.

---

## Proposed Changes

---

### Milestone 1: Unify Database Layer & Pipeline Executor (Ticket 01)

Eliminate `@supabase/supabase-js` from [`PipelineExecutor.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineExecutor.ts), `jobs` routes, and telemetry loggers. Standardize on direct `@aiva/database` connection pool queries.

#### [MODIFY] [PipelineExecutor.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineExecutor.ts)
- Replace `createClient<Database>` with `query` from `@aiva/database`.
- Rewrite job & project fetching using parameterized SQL: `SELECT j.*, row_to_json(p.*) as project FROM public.jobs j JOIN public.projects p ON j.project_id = p.id WHERE j.id = $1`.
- Rewrite job status/progress/`state_payload` updates and `job_events` insertions using SQL queries.
- Update `calculateProgress` and lifecycle checks to operate purely on Postgres state.

#### [MODIFY] [PipelineLogger.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineLogger.ts)
- Update logger to insert log rows directly via `@aiva/database` `query()`.

#### [MODIFY] [LifecycleService.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/LifecycleService.ts)
- Query job and project cancellation/pause states via `@aiva/database`.

#### [MODIFY] [apps/web/src/app/api/v1/jobs/[id]/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/[id]/route.ts)
- Replace Supabase client with parameterized `SELECT * FROM public.jobs WHERE id = $1`.

#### [MODIFY] [apps/web/src/app/api/v1/jobs/[id]/events/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/[id]/events/route.ts)
- Replace Supabase client with parameterized `SELECT * FROM public.job_events WHERE job_id = $1 ORDER BY created_at ASC`.

#### [MODIFY] [apps/web/src/app/api/v1/projects/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts)
- Restore session validation / user extraction and handle fallback cleanly.

---

### Milestone 2: Repair Monorepo Build & Shared Types Packaging (Ticket 02)

Ensure clean git checkouts compile and run without requiring untracked manual builds.

#### [MODIFY] [packages/shared-types/package.json](file:///d:/repos/AIVA/packages/shared-types/package.json)
- Add `"build": "tsc"`, `"prepare": "tsc"`.
- Ensure exports correctly resolve `.d.ts` and `.js` declarations for monorepo consumers.

#### [MODIFY] [package.json](file:///d:/repos/AIVA/package.json)
- Ensure root `build` script triggers `@aiva/shared-types` compilation before dependent workspaces (`pnpm --filter @aiva/shared-types build && pnpm --filter ...`).

#### [MODIFY] [apps/web/Dockerfile](file:///d:/repos/AIVA/apps/web/Dockerfile)
- Ensure `@aiva/shared-types` is built in the builder stage before `pnpm --filter web build`.

---

### Milestone 3: Wire Brief Parameters & Custom Script Bypass (Ticket 03)

Consume user brief parameters throughout all pipeline handlers and bypass `research`/`outline` for pasted scripts.

#### [MODIFY] [apps/web/src/app/api/v1/projects/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts)
- When `input_mode === 'custom_script'`, set initial job `current_step` to `'script_direction'`.
- Package `generation_profile` with `voice_id`, `aspect_ratio`, `duration_target_seconds`, and `persona` into `state_payload`.
- Enqueue BullMQ job starting at `script_direction` if custom script.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts)
- Read `voice_id` dynamically from `context.state.generationProfile?.voice_id` or `context.state.voice_id`, falling back to default voice.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/CompositionHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts)
- Read `aspect_ratio`, target dimensions (`width`, `height`), and pacing from `generation_profile`.

#### [MODIFY] [apps/workers/app/agents/script_director_agent.py](file:///d:/repos/AIVA/apps/workers/app/agents/script_director_agent.py)
- Support custom script input mode: segment and direct the user-provided script directly into scene breakdown objects without requiring a research outline.

---

### Milestone 4: Persist Scenes & Asset Tagging to PostgreSQL (Ticket 04)

Write scene breakdowns to `public.scenes` and `public.scene_versions` so Timeline Studio displays real data.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/ScriptHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/ScriptHandler.ts)
- After receiving `sceneDirections` from the worker, insert each scene into `public.scenes` (`id`, `project_id`, `sequence_number`, `duration`, `render_status`) and `public.scene_versions` (`id`, `scene_id`, `version_number`, `script_segment`, `visual_type`, `visual_prompt`).
- Ensure each scene is tagged with explicit asset types (`stock_photo`, `ai_image`, `character_animation`).

#### [MODIFY] [apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx)
- Ensure timeline fetches and updates real database scenes and scene versions.

---

### Milestone 5: Implement Parallel Scene Synthesis, Captions & Ducked Audio (Ticket 05)

Run per-scene TTS and asset synthesis concurrently, generate real `.srt` subtitles, and apply FFmpeg audio ducking.

#### [MODIFY] [apps/workers/app/agents/voiceover_agent.py](file:///d:/repos/AIVA/apps/workers/app/agents/voiceover_agent.py)
- Use `asyncio.gather` to synthesize scene voiceovers concurrently.
- Cleanly return `word_timings` for every scene.

#### [MODIFY] [apps/workers/app/pipelines/stage_handlers.py](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py)
- Remove duplicate dead line `agent = VoiceoverAgent(tts)`.
- Pass real `word_timings` through subtitle extraction stage instead of empty arrays.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/SubtitleHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/SubtitleHandler.ts)
- Harmonize subtitle output keys with `CompositionHandler` (`word_timings` / `wordTimings`).

#### [MODIFY] [apps/workers/app/core/composition/audio_mixer.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/audio_mixer.py)
- Bundle default royalty-free background music tracks in storage.
- Connect `sidechaincompress` audio filter in FFmpeg graph builder to automatically duck music under speech.

---

### Milestone 6: Implement True Single-Scene Re-render (Ticket 06)

Regenerate modified scene assets and re-stitch master MP4 without paying full video re-render costs.

#### [MODIFY] [apps/workers/app/pipeline/rerender_scene.py](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py)
- Read updated `script_segment` / `visual_prompt` from `public.scene_versions`.
- Re-synthesize only the target scene's voiceover (TTS + word boundaries).
- Re-render only the target scene's visual overlay (Remotion clip / image asset).
- Update stage checkpoints (`03_script`, `04_voice`, `06_assets`).
- Re-execute `CompositionEngine` stitching cached unchanged scene clips with the newly rendered scene clip.
- Update `public.scenes.render_status = 'completed'`.

#### [MODIFY] [apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts)
- Handle re-render dispatch with proper error trapping and status reporting.

---

### Milestone 7: Clean-Clone End-to-End Verification (Ticket 07)

Construct an automated end-to-end certification suite validating all 4 steps.

#### [NEW] [scripts/certify_v1_e2e.ts](file:///d:/repos/AIVA/scripts/certify_v1_e2e.ts)
- Automated verification script:
  1. Test 1: Submit topic brief, assert pipeline runs, assert `composition.mp4` and `subtitles.srt` generated.
  2. Test 2: Submit custom script brief, assert research/outline bypassed, assert `composition.mp4` generated.
  3. Test 3: Trigger single-scene re-render via API, assert targeted re-composition succeeds and updates master video.

---

## Verification Plan

### Automated Tests
```powershell
# 1. Verify shared-types and monorepo build
pnpm --filter @aiva/shared-types build
pnpm build

# 2. Run backend Python worker unit & pipeline tests
cd apps/workers
pytest tests/ -v

# 3. Run Web API tests
cd ../..
pnpm --filter web test

# 4. Run end-to-end V1 certification test
pnpm exec ts-node scripts/certify_v1_e2e.ts
```

### Manual Verification
- Launch local development stack (`docker compose up -d postgres redis` + `pnpm dev`).
- Open `http://localhost:3000`, submit a topic brief with custom voice selection, and verify MP4 output downloads.
- Open `http://localhost:3000`, paste a custom script, verify pipeline bypasses research and renders correctly.
- Open Timeline Studio (`/projects/[id]/timeline`), edit Scene 1 narration, click re-render, and verify only Scene 1 re-renders and the master video updates.
