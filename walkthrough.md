# AIVA V1 Remediation Walkthrough

## Phase 1: Master Voice Concatenation & Multi-Scene Audio Delivery

### Summary of Changes
- **`apps/workers/app/pipelines/stage_handlers.py`**: Added multi-scene TTS voiceover concatenation. In `handle_voiceover_stage`, all synthesized scene `.mp3` files are stitched via FFmpeg concat protocol into a unified `master_voice.mp3` stored under `storage/projects/{project_id}/`.
- **`apps/workers/app/routers/pipeline.py`**: Passed `project_id` from `VoiceoverStageRequest` into `handle_voiceover_stage`.
- **`apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts`**: Updated state synchronization to store `response.data.master_audio_url` in `state.voice.audioUrl` and `state.voice.master_audio_url`.
- **`apps/web/src/services/pipeline/handlers/CompositionHandler.ts`**: Updated `voiceUrl` resolution to prefer `master_audio_url` so the final video composition plays the concatenated narration for all scenes.
- **`apps/workers/tests/test_composition_ducking.py`**: Added unit test `test_handle_voiceover_stage_multi_scene_concatenation` verifying master audio generation.

### Files Modified
- [`apps/workers/app/pipelines/stage_handlers.py`](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py)
- [`apps/workers/app/routers/pipeline.py`](file:///d:/repos/AIVA/apps/workers/app/routers/pipeline.py)
- [`apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts)
- [`apps/web/src/services/pipeline/handlers/CompositionHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts)
- [`apps/workers/tests/test_composition_ducking.py`](file:///d:/repos/AIVA/apps/workers/tests/test_composition_ducking.py)

### Automated Verification Results
- **Worker Unit Tests**: `venv\Scripts\python.exe -m pytest tests/ -v` -> 11/11 passed (100%).
- **TypeScript Typecheck**: `pnpm --filter web exec tsc --noEmit` -> 0 errors.

### Manual QA Validation Steps
1. Create a multi-scene project (e.g. 2+ scenes).
2. Trigger the voiceover and composition stages.
3. Inspect `storage/projects/{project_id}/master_voice.mp3` and confirm it contains the full spoken narration across every scene in sequence.
4. Play the generated `storage/projects/{project_id}/composition.mp4` and verify that speech audio continues past Scene 1 through the entire duration of the video.

---

## Phase 2: Single-Scene Re-render & Master Re-Stitching

### Summary of Changes
- **`apps/workers/app/pipeline/rerender_scene.py`**:
  - Dynamically resolved project `voice_id`, `aspect_ratio`, and canvas geometry from `public.projects` / `jobs.state_payload` instead of hardcoded values.
  - Attached visual overlay tracks (`overlay_track`) from `public.scenes.render_url` during composition re-stitching.
  - Removed faulty guard `if valid_bg_tracks:` that was preventing `CompositionEngine.run` from executing when no separate background video files were present.
  - Hardened FFmpeg concat file generation with safe forward-slash path conversion and cleanup in a `finally` block.
- **`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`**: Awaited worker invocation with structured response data and logging instead of unawaited fire-and-forget.
- **`apps/workers/tests/test_rerender_scene.py`**: Updated test suite to verify dynamic profile loading and re-rendering flow.

### Files Modified
- [`apps/workers/app/pipeline/rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py)
- [`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/scenes/%5Bscene_id%5D/rerender/route.ts)
- [`apps/workers/tests/test_rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/tests/test_rerender_scene.py)

### Automated Verification Results
- **Worker Unit Tests**: `venv\Scripts\python.exe -m pytest tests/ -v` -> 11/11 passed (100%).
- **TypeScript Typecheck**: `pnpm --filter web exec tsc --noEmit` -> 0 errors.

### Manual QA Validation Steps
1. In the Timeline Studio UI (or via `POST /api/v1/projects/{id}/scenes/{scene_id}/rerender`), edit the script text of Scene 1.
2. Trigger a single-scene re-render.
3. Verify in `public.scenes` that only Scene 1's `script_segment`, `voiceover_url`, and `duration` were modified.
4. Verify that `storage/projects/{id}/composition.mp4` and `storage/projects/{id}/subtitles.srt` were re-rendered with the updated narration while preserving the rest of the project's scenes.

---

## Phase 3: Project Routes Authentication & Storage Stream Hardening

### Summary of Changes
- **`apps/web/src/app/api/v1/projects/route.ts`**: Restored user session validation using `x-user-id` request header with controlled local development fallback, eliminating arbitrary `SELECT id FROM auth.users LIMIT 1` database lookups and enforcing 401 Unauthorized for unauthenticated requests in production mode.
- **`apps/web/src/app/api/v1/projects/[id]/execute/route.ts`**: Harmonized user authentication with the project creation route.
- **`apps/web/src/app/api/v1/storage/[...path]/route.ts`**: Added Range header parameter validation (`isNaN`, boundary checks, `start <= end`) returning standard HTTP 416 (Range Not Satisfiable) on invalid range requests instead of throwing internal server errors.
- **Deleted `apps/web/proxy.ts`**: Removed redundant file at root of `apps/web`.

### Files Modified / Deleted
- [`apps/web/src/app/api/v1/projects/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts)
- [`apps/web/src/app/api/v1/projects/[id]/execute/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/execute/route.ts)
- [`apps/web/src/app/api/v1/storage/[...path]/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/%5B...path%5D/route.ts)
- `apps/web/proxy.ts` (Deleted)

### Automated Verification Results
- **TypeScript Typecheck**: `pnpm --filter web exec tsc --noEmit` -> 0 errors.

### Manual QA Validation Steps
1. Send a request to `POST /api/v1/projects` with custom header `x-user-id: 11111111-1111-1111-1111-111111111111` and verify that the created project in `public.projects` has `user_id = '11111111-1111-1111-1111-111111111111'`.
2. Request a media file via `GET /api/v1/storage/...` with an invalid range header (e.g. `Range: bytes=999999-1000000` on a small file) and verify that HTTP 416 Range Not Satisfiable is returned.

---

## Phase 4: Clean-Clone End-to-End Pipeline Certifier

### Summary of Changes
- **`apps/workers/app/core/storage.py`**: Created deterministic shared storage resolver `get_project_storage_dir` used uniformly across workers, composition engine, and pipeline runners.
- **`apps/workers/app/pipeline/certifier_runner.py`**: Created unmocked CLI runner allowing end-to-end stage execution from TypeScript with delimited JSON envelopes and UTF-8 stream handling.
- **`scripts/certify_pipeline.ts`**: Rewrote the pipeline certifier to execute real, unmocked media pipelines across 5 comprehensive suites:
  1. *Suite 1*: Topic Brief & Multi-Scene Persistence with relational tagging.
  2. *Suite 2*: Parallel EdgeTTS synthesis, multi-scene audio concatenation (`master_voice.mp3`), and word timing extraction.
  3. *Suite 3*: FFmpeg Composition Engine execution, audio ducking mixer, SubRip generation (`subtitles.srt`), and MP4 rendering (`composition.mp4`).
  4. *Suite 4*: Single-Scene timeline re-render, scene voice re-synthesis, and master MP4 re-composition.
  5. *Suite 5*: Custom Script direct ingestion and verbatim narration bypass.
- **`apps/workers/app/core/composition/engine.py`**: Integrated `get_project_storage_dir` for master video and subtitle export.

### Files Modified / Created
- [`apps/workers/app/core/storage.py`](file:///d:/repos/AIVA/apps/workers/app/core/storage.py) (NEW)
- [`apps/workers/app/pipeline/certifier_runner.py`](file:///d:/repos/AIVA/apps/workers/app/pipeline/certifier_runner.py) (NEW)
- [`apps/workers/app/core/composition/engine.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/engine.py)
- [`scripts/certify_pipeline.ts`](file:///d:/repos/AIVA/scripts/certify_pipeline.ts)
- [`.gitignore`](file:///d:/repos/AIVA/.gitignore)

### Automated Verification Results
- **Pipeline Certifier**: `pnpm test:pipeline` -> 5/5 Suites PASSED (100% genuine end-to-end media generation).
- **Worker Unit Tests**: `venv\Scripts\python.exe -m pytest tests/ -v` -> 11/11 PASSED (100%).
- **Web App Production Build**: `pnpm --filter web build` -> Next.js 16 build succeeded with 0 errors.

### Manual QA Validation Steps
1. Run `pnpm test:pipeline` in the terminal and verify that all 5 suites pass with green checkmarks.
2. Inspect `.artifacts/validation_report.md` and confirm that all media generation invariants are verified.
