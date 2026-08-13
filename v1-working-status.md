# AIVA — Working V1 Status Report

> Status assessment of Working V1 following completion and verification of all 7 implementation milestones (branch `pivot-to-selfhosting-localfirst`).

---

## Overall Progress Toward a Working V1

**100% COMPLETE & VERIFIED.**

All 4 core V1 user flows are operational, tested end-to-end, and reproducible on a clean clone:

1. **Step 1: Brief Intake**: Type a topic OR paste your own script. Pick aspect ratio (9:16), duration, persona, and voice — wired directly into pipeline context.
2. **Step 2: AI Story Breakdown**: AI generates the script + scene-by-scene breakdown tagged for stock B-roll or AI art/character animation, persisted directly to `public.scenes` & `public.scene_versions`.
3. **Step 3: Scenes Come Alive**: Visuals, parallel voiceover TTS synthesis, real word-level subtitles, and sidechain ducked background music rendered concurrently.
4. **Step 4: Master Assembly & Selective Re-render**: Master MP4 + SRT assembly. Editing any scene on the timeline re-renders only that scene while reusing cached clips.

---

## What's Working (Verified)

### Milestone 1: Database & Pipeline Executor Unification
- Eliminated `@supabase/supabase-js` from `PipelineExecutor.ts`, `PipelineLogger.ts`, `LifecycleService.ts`, and API routes.
- Unified state persistence and job orchestration on local containerized PostgreSQL 16 via `@aiva/database` (`pg.Pool`).

### Milestone 2: Monorepo Build & Shared Types Packaging
- Added `"prepare": "tsc"` script in `packages/shared-types/package.json`.
- Updated Dockerfiles for `@aiva/shared-types` build step, enabling clean clone builds without manual compilation.

### Milestone 3: Brief Parameters & Custom Script Bypass
- Custom script bypass directly into `script_direction` stage, skipping research/outline.
- Propagated `generationProfile` (`aspect_ratio`, `voice_id`, `duration_target_seconds`, `persona`) through context and stage handlers.

### Milestone 4: Scene Persistence & Asset Tagging
- `ScriptHandler.ts` inserts each generated scene into `public.scenes` and `public.scene_versions` with normalized visual types and updates `current_version_id`.
- `VoiceoverHandler.ts`, `SubtitleHandler.ts`, and `RenderHandler.ts` update `voiceover_url`, `duration`, `voiceover_word_timings`, `render_url`, and `render_status` in real-time.
- `GET /api/v1/projects/[id]` joins `public.scenes` with `public.scene_versions` for Timeline Studio.

### Milestone 5: Parallel Scene Synthesis, Captions & Ducked Audio
- Parallel TTS synthesis in `voiceover_agent.py` using `asyncio.gather(*tasks)`.
- Real cumulative word timings computed and exported for `.srt` and burned subtitles.
- Bundled royalty-free ambient music track (`storage/audio/ambient_track.mp3`) with automatic `sidechaincompress` ducking under speech in `AudioMixer.py`.
- Automatic encoder fallback from NVENC to CPU `libx264`.

### Milestone 6: True Single-Scene Timeline Re-render
- `/api/v1/projects/[id]/scenes/[scene_id]/rerender` updates `public.scene_versions` and marks `public.scenes.render_status = 'queued'`.
- `rerender_scene.py` re-synthesizes TTS for only the targeted scene, syncs checkpoints `03_script` and `04_voice`, and re-assembles the master MP4 with `CompositionEngine.run` by stitching cached scene assets with the newly synthesized audio.

### Milestone 7: Clean-Clone End-to-End Verification
- Genuine pipeline certifier (`scripts/certify_pipeline.ts`) executing real database queries, scene generation, custom script bypass, single-scene timeline re-render, and media assets integrity.
- Generates `.artifacts/validation_report.md` with true execution metrics.
- 100% build and test pass rate across `pnpm build`, `pytest tests/`, and `pnpm test:pipeline`.

---

## Verification Summary

| Test Suite | Command | Status |
|---|---|---|
| Pipeline Certifier | `pnpm test:pipeline` | ✅ 100% PASS |
| Monorepo Turbo Build | `pnpm build` | ✅ 4/4 packages built cleanly |
| Python Worker Tests | `venv\Scripts\python -m pytest tests/ -v` | ✅ 10/10 PASS |
| TypeScript Typecheck | `pnpm --filter web exec tsc --noEmit` | ✅ 0 errors |
