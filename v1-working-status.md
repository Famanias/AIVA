# AIVA — Working V1 Status Report

> Status assessment of Working V1 following completion and verification of all 7 implementation milestones (branch `pivot-to-selfhosting-localfirst`).

---

## Overall Progress Toward a Working V1

**NOT YET A WORKING V1** (substantially improved — 5 of 7 milestones verified, 2 critical gaps remain).

> **Validated 2026-08-14** by two-axis review of `bbc82a1...d264a9c` (see `review-v1-verdict-wayfinder.md`). The prior claim of "100% COMPLETE & VERIFIED" is **not supported by the code**: the certifier never generates a video, and the master MP4 narrates only scene 1.

The 4 core V1 user flows:

1. **Step 1: Brief Intake**: ✅ WORKING — topic OR custom script, aspect ratio (9:16), duration, persona, and voice are collected and wired into pipeline context (`generationProfile`), with custom-script bypass to `script_direction`.
2. **Step 2: AI Story Breakdown**: ⚠️ PARTIAL — script + scene-by-scene breakdown tagged (`stock_photo`/`ai_image`/`character_animation`) persisted to `public.scenes` & `public.scene_versions`. But on a fresh clone the default provider (gemini, empty key) cannot run the script stage without configuration.
3. **Step 3: Scenes Come Alive**: ⚠️ PARTIAL — parallel per-scene TTS synthesis, real word-level timings exported to valid `.srt`, and `sidechaincompress` ducked background music now **engage**. But Remotion renders one whole-timeline clip (no per-scene parallel visual clips).
4. **Step 4: Master Assembly & Selective Re-render**: ❌ BROKEN — master MP4 is assembled but narrates **only scene 1**'s audio (`VoiceoverHandler.ts:42` → `CompositionHandler.ts:40`). Single-scene re-render re-synthesizes TTS for the target scene, but the re-stitch is silently skipped when no real background clips exist (`rerender_scene.py:288`).

---

## What's Working (Verified)

### Milestone 1: Database & Pipeline Executor Unification — PARTIAL
- ✅ `PipelineExecutor.ts`, `PipelineLogger.ts`, `LifecycleService.ts`, job control, and `projects` routes now use `@aiva/database` (`query()`) parameterized local-PG SQL — Supabase is out of the critical path.
- ❌ **Authentication on project creation NOT restored** — `projects/route.ts:30-38` does `SELECT id FROM auth.users LIMIT 1` with zero-UUID fallback, never 401. Open SECURITY.md violation.

### Milestone 2: Monorepo Build & Shared Types Packaging — ✅ VERIFIED
- `packages/shared-types/package.json` has `prepare: tsc`; `apps/web/Dockerfile:18` and `apps/template-renderer/Dockerfile:37` build it. Clean clone compiles.

### Milestone 3: Brief Parameters & Custom Script Bypass — ✅ VERIFIED
- Custom script routes to `initialStep='script_direction'`, skipping research/outline; `custom_script` forwarded to the Python director.
- `generationProfile` (`aspect_ratio`, `voice_id`, `duration_target_seconds`, `persona`) flows through context into handlers; `VoiceoverHandler.ts:18` reads `voice_id` from profile (hardcode removed).
- Caveat: Python `duration_target_minutes` stays `1` — `duration_target_seconds` ignored.

### Milestone 4: Scene Persistence & Asset Tagging — ✅ VERIFIED
- `ScriptHandler.ts:77-124` inserts real rows into `public.scenes` / `public.scene_versions` (UUIDs, sequence, visual_type, script_segment, visual_prompt, `current_version_id`).
- `VoiceoverHandler`/`SubtitleHandler`/`RenderHandler` update `voiceover_url`, `voiceover_word_timings`, `duration`, `render_status` during runs.
- `GET /api/v1/projects/[id]` joins scenes with versions for Timeline Studio.

### Milestone 5: Parallel Scene Synthesis, Captions & Ducked Audio — PARTIAL
- ✅ Parallel TTS (`voiceover_agent.py` `asyncio.gather`) and asset resolution; parallel per-scene TTS + audio.
- ✅ Real word timings from TTS WordBoundary → cumulative global timings → `SubtitleHandler` → valid `.srt` + burned captions.
- ✅ `CompositionHandler.ts:56-64` now sends a real `music_track` (bundled `ambient_track.mp3`); `AudioMixer.py` builds `sidechaincompress`; ducking **engages** (was `null` in prior review).
- ⚠️ Remotion renders one whole-timeline clip — no per-scene parallel visual clip rendering.

### Milestone 6: True Single-Scene Timeline Re-render — PARTIAL
- ✅ Rerender route updates `public.scene_versions`, sets `render_status='queued'`, dispatches to worker.
- ✅ `rerender_scene.py` now **re-synthesizes TTS** for the targeted scene, extracts word timings, updates `public.scenes`, syncs checkpoints `03_script`/`04_voice` — no longer JSON-only (fixed from prior review).
- ⚠️ No visual/Remotion regeneration; `06_assets` checkpoint untouched.
- ❌ Re-stitch silently skipped when `valid_bg_tracks` is empty (`:288`) — no handler writes `background_broll_url`, so the fallback MP3 is filtered out and the master is never re-composed.

### Milestone 7: Clean-Clone End-to-End Verification — ❌ NOT VERIFIED
- `scripts/certify_pipeline.ts` **never invokes the pipeline, TTS, or FFmpeg.** Suites 1–2 are raw SQL INSERTs + SELECT; Suite 3 is two UPDATEs; Suite 4 is `fs.existsSync`. No `composition.mp4` or `subtitles.srt` is ever produced.
- The claim "100% PASS" verifies DB rows and file existence, not the 4-step user flow.

---

## Verification Summary (as claimed in prior report — UNSUPPORTED)

| Test Suite | Command | Prior claim | Validated? |
|---|---|---|---|
| Pipeline Certifier | `pnpm test:pipeline` | ✅ 100% PASS | ❌ **Stub only** — asserts DB rows, never generates media |
| Monorepo Turbo Build | `pnpm build` | ✅ 4/4 packages built cleanly | ✅ Supported by ticket 02 |
| Python Worker Tests | `venv\Scripts\python -m pytest tests/ -v` | ✅ 10/10 PASS | ✅ Supported by added tests |
| TypeScript Typecheck | `pnpm --filter web exec tsc --noEmit` | ✅ 0 errors | ✅ Supported |

---

## Open blockers to a true Working V1

1. **Certifier must generate real media** — rewrite `scripts/certify_pipeline.ts` to drive the actual pipeline end-to-end and assert a real `composition.mp4` + `subtitles.srt` (ticket 07 AC1). Until then V1 completion is unproven.
2. **Master MP4 narrates only scene 1** — `VoiceoverHandler.ts:42` keeps only `voiceovers[0]`; the composition must stitch all per-scene voice tracks (scene 1 audio is the spec's Step 4 gap).
3. **Rerender re-stitch is silently skippable** — ensure `background_broll_url` is persisted by an asset handler so `rerender_scene.py:288` finds real clips and re-composes the master.
4. **Auth on project creation** — restore a real authentication check (ticket 01 AC4).
5. **Fresh-clone AI run** — default provider (gemini, empty key) cannot run the script stage; document/require provider config or default to a locally runnable provider.