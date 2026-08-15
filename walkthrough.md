# Walkthrough — Video Generation Pipeline Remediation

We have successfully cross-examined [VIDEO_GENERATION_ARCHITECTURE_ANALYSIS.md](file:///d:/repos/AIVA/VIDEO_GENERATION_ARCHITECTURE_ANALYSIS.md), addressed user feedback, and implemented the deep seam contracts across `@aiva/shared-types`, Python workers, Node.js orchestrator, Remotion renderer, and the FFmpeg compositor.

---

## Key Changes Implemented

### 1. Canonical Shared Types & Contracts (`packages/shared-types`)
- In [types.ts](file:///d:/repos/AIVA/packages/shared-types/src/types.ts), defined canonical interfaces:
  - `AssetRef` & `AssetManifest`: strongly typed media references with opaque IDs, MIME types, and guaranteed background slots.
  - `VoiceoverScene` & `VoiceState`: canonical arrays containing `sequence_number`, `audio_url`, `duration_sec`, and `word_timings`.
  - `CanvasConfig` & `TimelineContract`: single source of truth for duration, frame counts, and rendering geometry.

### 2. Master Audio Duration Contract (`apps/workers` & `apps/web`)
- Added `get_audio_duration(file_path: str) -> float` in [audio_utils.py](file:///d:/repos/AIVA/apps/workers/app/core/audio_utils.py) using `ffprobe`.
- In [stage_handlers.py](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py), `handle_voiceover_stage` probes the exact duration of `master_voice.mp3` and returns `master_duration_sec`.
- In [VoiceoverHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts), populated `voice.voiceovers` and `voice.master_duration_sec`.
- In [TimelineGenerator.ts](file:///d:/repos/AIVA/apps/template-renderer/src/core/TimelineGenerator.ts), `RenderHandler.ts`, and [CompositionHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts), anchored total video and overlay durations directly to `master_duration_sec`.
- In [encoder.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/encoder.py), anchored `-t` encoding limit primarily to `model.voice_track.duration`, completely eliminating ~10s premature cutoff.

### 3. Self-Contained Stickman Template Layering (`apps/template-renderer`)
- In [CharacterRig.tsx](file:///d:/repos/AIVA/apps/template-renderer/src/templates/character-rig/CharacterRig.tsx), added `BackgroundLayer` that renders scene media (`assetUrl`) with ambient dark gradient fallback behind the animated stickman SVG.
- Resolves transparent blank/black screens in single-scene studio previews and master renders.

### 4. Dynamic Canvas Subtitle Geometry (`apps/workers`)
- In [subtitle_generator.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/subtitle_generator.py), replaced static vertical ASS header with dynamic `_build_ass_header(width, height, aspect_ratio)`.
- Automatically scales font size, margins (`MarginV`), and resolution (`PlayResX`, `PlayResY`) for 9:16 Shorts, 16:9 YouTube horizontal, and 1:1 square videos.

### 5. Windows Path Handling in Asset Downloader (`apps/workers`)
- In [asset_downloader.py](file:///d:/repos/AIVA/apps/workers/app/services/asset_downloader.py), fixed local path and `file:///` parsing. Normalized backslashes and sanitized destination file names to prevent Windows drive letter colon errors (`OSError: [Errno 22]`).

---

## Verification Results

### 1. Python Worker Pytest Suite (38/38 Passed)
```powershell
$env:PYTHONPATH="."; .\venv\Scripts\pytest
```
- `test_asset_downloader_local_and_file_urls`: PASSED
- `test_dynamic_ass_subtitle_generation` (9:16 & 16:9 ASS headers): PASSED
- `test_handle_voiceover_stage_multi_scene_concatenation`: PASSED
- `test_composition_engine_ducking_e2e`: PASSED
- `test_fallback_asset_provider`: PASSED
- Full suite: **38 passed in 17.58s**.

### 2. TypeScript & Monorepo Build
```powershell
pnpm build
```
- `@aiva/shared-types`: PASSED
- `@aiva/prompt-library`: PASSED
- `aiva-template-renderer`: PASSED (`tsc --noEmit`)
- `web`: Next.js 16 build PASSED (19 static & dynamic routes generated cleanly).
- Turbo: **4 successful, 4 total**.
