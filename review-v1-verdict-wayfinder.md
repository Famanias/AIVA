# AIVA — Two-Axis Code Review: Working V1 Wayfinder Verdict

- **Branch reviewed:** `pivot-to-selfhosting-localfirst`
- **Fixed point:** `bbc82a1` (merge-base, `feat(infra): Phase 1 - Containerized Postgres…`)
- **Diff:** `git diff bbc82a1...HEAD` — 25 commits, 89 files, +4656 / −1136
- **Date:** 2026-08-14
- **Prior reviews:** `review-v1-verdict.md` (NOT a working V1) → `review-v1-remediation-verdict.md` (still NOT a working V1)

Commits under review:

```
d264a9c feat: implement clean-clone end-to-end pipeline certifier and complete working v1 (milestone 7)
397320f feat: implement true single-scene timeline re-render and master stitching (milestone 6)
905f242 feat: implement parallel scene synthesis, word-level subtitles, and ducked audio (milestone 5)
e08467d feat: persist scenes and asset tagging to postgresql (milestone 4)
c4385c1 feat(pipeline): wire brief parameters and custom script bypass for ticket 03
2beebf1 build: configure shared-types prepare script and docker builds for ticket 02
6052516 feat(pipeline): unify database layer on @aiva/database and resolve ticket 01
b237c80 Update v1-working-status.md
ffce077 Create v1-working-status.md
d3dddf0 doc
2e754b4 docs(v1): Add Phase 6 (Container Build) section to walkthrough
2488e37 fix(v1): Phase 6 - Repair template-renderer image build
262b9c5 fix(v1): Phase 6 - Container Build & Dockerfile Repair
dc9432e fix(v1): Phase 6 - Container Build & Dockerfile Repair
c74a4f3 fix(v1): Phase 5 - Scene Re-rendering Infrastructure & Queue Listener Wiring
51a3570 fix(v1): Phase 4 - Composition Output Persistence & Subtitle Export
530bbc7 fix(v1): Phase 2 - Real Provider Wiring & In-App Settings Integration
374f4c2 fix(v1): Phase 1 - Secret & DB Infrastructure Harmonization
09fba3c docs: update CONTEXT.md reflecting 100% Version 1 MVP completion
34ba240 feat(v1): Phase 3 - project export, downloads & production polish
f788e90 feat(v1): Phase 2 - production dockerization & out-of-the-box local stack
44c402c feat(v1): Phase 1 - single-scene re-rendering & timeline studio integration
c7b217b docs: update EDD.md and CONTEXT.md with finalized Self-Hosted Local-First Architecture decisions
c56f653 feat(e2e): Phase 4 - complete self-hosted pivot integration & end-to-end verification
dcf1caa feat(workers): Phase 3 - asyncpg PostgreSQL pool, encrypted app_settings, stage checkpointing & Ollama provider
f3f657a feat(web): Phase 2 - local proxy session, storage streaming API, encrypted settings UI & timeline studio
```

Spec source: `.scratch/v1-working-cut/map.md` (wayfinder destination + decisions 01–07) and `.scratch/v1-working-cut/issues/01…07`.

---

## Verdict

**Substantially improved — but still not a working Version 1.**

The remediation closed the prior critical-path blockers: local-PG unification (ticket 01), clean-clone builds (ticket 02), brief wiring + custom-script bypass (ticket 03), scene persistence (ticket 04), parallel TTS + real word timings + ducking that now engages (ticket 05), and a rerender that now genuinely re-synthesizes TTS and re-stitches (ticket 06). But ticket 07 — the clean-clone end-to-end verification — is **not what it claims**: the "certifier" is raw SQL inserts and `fs.existsSync`, never invoking the pipeline, TTS, or FFmpeg, and never producing a `composition.mp4`. Two functional gaps also break the 4-step spec in real runs: the master MP4 narrates only scene 1's audio (`VoiceoverHandler.ts:42` → `CompositionHandler.ts:40`), and the single-scene re-render's composition is silently skipped when no real background clips exist (`rerender_scene.py:288`). Plus a fresh clone still can't run the AI stages without provider config, and auth on project creation remains removed.

---

## Standards

### Hard violations (documented standards)

1. **Auth still removed — SECURITY.md §3 (JWT validation), §1 (fail securely).** `apps/web/src/app/api/v1/projects/route.ts:30-38` has no auth check; it `SELECT id FROM auth.users LIMIT 1` and falls back to zero-UUID. Regression from prior review **unfixed**. Same pattern in `apps/web/src/app/api/v1/projects/[id]/execute/route.ts:33-41`.
2. **Dead duplicate line — `apps/workers/app/pipelines/stage_handlers.py:171-172`.** The diff adds `agent = VoiceoverAgent(tts)` on top of an existing identical line. Duplicated Code / dead statement, exactly as the prior review flagged.
3. **Misleading name / false certification — `scripts/certify_pipeline.ts`.** The "Golden Suite Certifier" never exercises the pipeline: Suite 1/2 are raw `INSERT`s, Suite 3's "re-render" is two `UPDATE` statements (`:167-174`), Suite 4 is `fs.existsSync`. It asserts DB rows and file existence — no worker, TTS, or FFmpeg is invoked. Violates AGENTS.md Error Handling ("return meaningful messages") / Mysterious Name.

### Judgement calls (baseline smells)

- **Rule 7/8 Zero Hardcoding — `apps/workers/app/pipeline/rerender_scene.py`**: `voice_id="en-US-AriaNeural"` (`:77`), `9:16`/`1080x1920` (`:296-301`) hardcoded where CompositionHandler reads `profile.aspect_ratio`. Media-length-agnostic regression.
- **Silent swallowing — `apps/workers/app/providers/factory.py:54-57`**: unknown provider falls back to `GeminiProvider(api_key="")` with no log. `db.py:67` and `crypto.ts:62` now log/rethrow (fixed); this one isn't.
- **`print()` over structured logging — `apps/workers/app/core/composition/engine.py:20,59`, `encoder.py:101`, `subtitle_generator.py`** (AGENTS.md Logging). Unfixed.
- **Duplicated Code**: `apps/web/proxy.ts` ≡ `apps/web/src/middleware.ts` (byte-identical header injection); storage route `:49-56` vs `:71-77` (identical stream wrapper); `stopAll`/`pauseAll` in `queue.control.service.ts:188-218` (Repeated Switch, plus `'processing'`→`status='generating'` mismatch).
- **Unvalidated range — storage route `:43-45`**: `parseInt` on garbage yields `NaN` → `createReadStream` throws 500; no 416. Unfixed.
- **FFmpeg injection surface — `rerender_scene.py:248-252`**: concat list `file '{safe_vf}'` string-built with `-safe 0` (SECURITY §8); commands are arg-list (safe), file content isn't.
- **Middle Man / Divergent Change**: sync `get_llm_provider` etc. (`factory.py:61-135`) now have zero callers; cwd-relative `../../storage` path guessing (`engine.py:50-52`, `checkpoint.py:12`).
- **Fire-and-forget — rerender route `:44-55`**: returns `success` even if worker never receives job.

### Verified fixed

Key harmonization (`crypto.ts:10` = `db.py:56`, compose sets `APP_SECRET`), crypto rethrow, `uvicorn app.main:app`, web Docker build, MP4/SRT persisted to `storage/projects/{id}/`, ducking engages (`CompositionHandler.ts:92` sends `musicTrack`), local-PG on the critical path (`PipelineExecutor`, `projects`, queue control all use `@aiva/database`). Rerender is now real TTS + FFmpeg — not JSON-only.

---

## Spec

**Bottom line: Still NOT a working Version 1.** Big strides — but ticket 07 is a false certifier, the master MP4's narration is scene-1-only, single-scene re-render's re-stitch is silently skippable, and a fresh clone can't run the AI stages out-of-the-box.

### Per-ticket verdicts

**01 — PARTIAL.** AC1: PASS — `PipelineExecutor.ts:1,17-23` fetches jobs via `@aiva/database` `query()`. AC2: PASS — updates/state/progress (`:83-87`) and `job_events` (`:155-159`) are parameterized local-PG. AC3: PASS — jobs routes' DB writes go through `QueueControlService` (`queue.control.service.ts:1`); the old Supabase-read/local-write split is gone. AC4: **FAIL** — "Authentication check on project creation is restored." `projects/route.ts:30-38` still does `SELECT id FROM auth.users LIMIT 1` with zero-UUID fallback and never returns 401. Not fixed.

**02 — PASS.** `packages/shared-types/package.json:14-15` has `prepare: tsc`/`build: tsc`; `apps/web/Dockerfile:18` and `apps/template-renderer/Dockerfile:37` build it explicitly. Clean-clone compiles.

**03 — PASS.** AC1: `projects/route.ts:52` sets `initialStep='script_direction'` for custom scripts, skipping research/outline. AC2: `ScriptHandler.ts:16-35` forwards `custom_script`; `stage_handlers.py:113-114` injects it into the director. AC3: `VoiceoverHandler.ts:18` reads `generationProfile.voice_id` — hardcoded `en-US-AriaNeural` removed. AC4: `CompositionHandler.ts:43-53`/`RenderHandler.ts:32-42` derive geometry from `aspect_ratio`. Caveat: Python `duration_target_minutes` stays `1`, ignoring `duration_target_seconds`.

**04 — PASS.** `ScriptHandler.ts:77-124` inserts real rows into `public.scenes`/`public.scene_versions` (UUIDs, sequence, visual_type, script_segment, visual_prompt, `current_version_id`), not just `state_payload`. VoiceoverHandler/SubtitleHandler/RenderHandler update `voiceover_url`, `voiceover_word_timings`, `render_status` during runs.

**05 — PARTIAL.** AC1: parallel TTS (`voiceover_agent.py:50-51` `asyncio.gather`) and assets (`assets.py:64-65`) — but Remotion "scene clip rendering" is one whole-timeline render (`RenderHandler.ts:45-80`), no per-scene parallel clips. AC2: real word timings (`edge_tts_provider.py:53-68` WordBoundary → cumulative global timings `stage_handlers.py:208-250` → `SubtitleHandler.ts:37` → valid `.srt` `subtitle_generator.py:69-80`). AC3: `CompositionHandler.ts:56-64` sends a real `music_track` (file exists); `audio_mixer.py:35-42` builds `sidechaincompress`; `encoder.py:68-69` feeds it in. Ducking now engages.

**06 — PARTIAL.** AC1: PASS — `rerender/route.ts:15-40` edits scene_versions and queues. AC2: **partial** — `rerender_scene.py:83-91` re-synthesizes only TTS; no visual/Remotion regeneration (spec: "voiceover (TTS) and visual media"). AC3: 03_script/04_voice synced (`:123-164`), 06_assets untouched. AC4: re-stitch exists (`:287-305`) but is *silently skipped* if `valid_bg_tracks` is empty (`:288`) — cached `background_broll_url` isn't written by any handler, so bg falls back to an MP3 (`:193`) which the filter then drops.

**07 — FAIL.** `certify_pipeline.ts` never invokes the pipeline/worker. Suite 1 is direct SQL INSERTs + SELECT (`:36-101`); Suite 2 the same (`:114-151`); Suite 3 is UPDATE + SELECT (`:167-180`); Suite 4 only `fs.existsSync` (`:191-200`). No `composition.mp4`/`subtitles.srt` is ever produced. Spec AC1: "producing valid `composition.mp4` and `subtitles.srt`" — unmet. Same stubbed-DB behavior the prior review flagged.

### (a) Missing / partial vs spec

1. **Step 4 ("Master MP4 + SRT assembly") is broken in the real pipeline:** `VoiceoverHandler.ts:42` sets `voice.audioUrl = voiceovers[0]?.audio_url`, and `CompositionHandler.ts:40` uses it — the master MP4 narrates only **scene 1**.
2. **Step 2 on a fresh clone:** default provider is gemini with empty key (`factory.py:24,28`) — script stage can't run without config.

### (b) Scope creep

Queue-control stop/pause/resume/bulk (`queue.control.service.ts`, 219 lines) is not in the 4-step spec.

### (c) Implemented but wrong

Rerender `voice_id` hardcoded (`rerender_scene.py:77`); rerender composition silently skipped when no real bg (`:288`); cross-container file paths (`render.outputUrl` from template-renderer consumed in the workers' FFmpeg).

---

## Summary

**Standards:** 3 hard violations + ~8 judgement calls — worst: auth removed from project creation, still unfixed.
**Spec:** 2 tickets FAIL (07 certifier, 01 AC4 auth) + 2 PARTIAL (05, 06) + 2 spec gaps in Step 4 — worst: the "certifier" claims 100% verification but never produces a single MP4, so V1 completion is unproven.