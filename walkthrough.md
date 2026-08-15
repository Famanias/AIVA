# Video Generation Pipeline Walkthrough: Live Stock Media & Dynamic Visuals

## Overview
We identified and resolved why the pipeline was falling back to solid ambient backgrounds, successfully connected the user's **Pexels and Pixabay** stock media providers, calibrated semantic ranking thresholds, and fixed the FFmpeg compositor's video layer rendering.

---

## Root Cause Analysis & Fixes

1. **Worker `.env` Path & SSL Configuration**:
   - **Issue**: FastAPI worker could not locate the root `.env` containing `PEXELS_API_KEY` and `PIXABAY_API_KEY`, and Windows `aiohttp` SSL handshakes failed without CA certificates.
   - **Fix**: Updated [`config.py`](file:///d:/repos/AIVA/apps/workers/app/core/config.py) to resolve repo root `.env` via `Path(__file__).resolve().parents[3] / ".env"` and added `certifi` CA context to [`asset_providers.py`](file:///d:/repos/AIVA/apps/workers/app/providers/asset_providers.py) and [`asset_downloader.py`](file:///d:/repos/AIVA/apps/workers/app/services/asset_downloader.py).

2. **Semantic Ranking Threshold Calibration**:
   - **Issue**: `semantic_threshold` was set to `0.75` in [`AssetConfig`](file:///d:/repos/AIVA/apps/workers/app/models/asset.py), which is too restrictive for cosine similarity between script narration and stock video metadata tags (~0.25–0.50 score).
   - **Fix**: Lowered `semantic_threshold` to `0.20` in [`asset.py`](file:///d:/repos/AIVA/apps/workers/app/models/asset.py) and normalized search queries in [`assets.py`](file:///d:/repos/AIVA/apps/workers/app/routers/assets.py).

3. **Chromium Local Asset & Data URI Separation**:
   - **Issue**: [`AssetResolver.ts`](file:///d:/repos/AIVA/apps/template-renderer/src/core/AssetResolver.ts) was converting local `.mp4` video files into multi-megabyte base64 Data URIs, which HTML5 `<video>` tags in Chromium cannot stream.
   - **Fix**: Kept local video files as direct file paths with Chromium `disableWebSecurity: true` while keeping fast base64 data URIs for static images.

4. **FFmpeg Visual Layer Priority & Alpha Handling**:
   - **Issue**: In [`graph_builder.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/graph_builder.py), when Remotion rendered an opaque documentary MP4, it was overlaid on top of `[bg_concat]`, obscuring the real stock video footage.
   - **Fix**: Updated [`graph_builder.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/graph_builder.py) and [`CompositionHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts) so only transparent WebM character rigs (like stickman) are overlaid, while `[bg_concat]` is used directly for stock video and photo sequences.

---

## Visual Verification & Output

We watched the latest generated video:
- **Location**: [`D:\repos\AIVA\storage\projects\66c2bbf0-e407-4c65-bdea-207ac886f9ac\composition.mp4`](file:///d:/repos/AIVA/storage/projects/66c2bbf0-e407-4c65-bdea-207ac886f9ac/composition.mp4)
- **File Size**: `10.72 MB` (1080x1920 @ 30fps)
- **Visual Breakdown**:
  - **Scene 1**: Vertical HD stock video of a student/remote worker with coffee cup and study notes (*"Think caffeine gives you energy? Think again."*)
  - **Scene 2**: Vertical HD stock video of a sleepy black cat with vivid green eyes (*"Caffeine does not create energy. It only blocks adenosine..."*)
  - **Scene 3**: Vertical HD stock video of fresh ground espresso in a pour-over dripper (*"While adenosine continues accumulating in the background..."*)
  - **Scene 4**: Vertical AI artwork of a towering skyscraper in a stormy night (*"When caffeine inevitably metabolizes, that backlog of exhaustion crashes in all at once."*)
  - **Scene 5**: Vertical 4K aerial stock footage of emerald ocean waves crashing (*"That is why you crash."*)

## Observations & Next Steps

Upon observation, the video provides actual stock footage now, but further improvements are needed:
- **Subtitles & Sync**: We need to improve subtitle accuracy and syncing them properly with the audio.
- **Long-form Videos**: We need to produce long-form videos, not just 10-second clips.
- **Voice-over Fix**: The voice-over at the end was cut off; this needs to be fixed.

> [!NOTE]
> These tests were executed via backend/scratch scripts directly, not through the frontend UI. The relevant scripts used for this testing are:
> - [`test_custom_script_pipeline.mjs`](file:///C:/Users/PC/.gemini/antigravity-ide/brain/eb7cd134-dafa-437a-a142-c4f43a668854/scratch/test_custom_script_pipeline.mjs): Used to drive the orchestration of a custom script generation.
> - [`test_asset_fetch.py`](file:///C:/Users/PC/.gemini/antigravity-ide/brain/eb7cd134-dafa-437a-a142-c4f43a668854/scratch/test_asset_fetch.py): Used to test directly calling the Pexels/Pixabay APIs.
> - [`test_strategy_live.py`](file:///C:/Users/PC/.gemini/antigravity-ide/brain/eb7cd134-dafa-437a-a142-c4f43a668854/scratch/test_strategy_live.py): Used to test the strategy worker's asset resolution pipeline.
