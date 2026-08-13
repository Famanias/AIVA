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
