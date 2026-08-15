# Video Generation Pipeline Architecture Remediation Plan

## Executive Summary

Cross-examination of [VIDEO_GENERATION_ARCHITECTURE_ANALYSIS.md](file:///d:/repos/AIVA/VIDEO_GENERATION_ARCHITECTURE_ANALYSIS.md) against the active codebase reveals that while the document's theoretical diagnosis of shallow seams and architecture smells is largely accurate, its specific claim that `AssetDownloader` crashes on `LocalSolidFallbackProvider` paths is **factually incorrect** (as `AssetDownloader` explicitly supports local paths via `os.path.exists`).

However, the pipeline suffers from four concrete root causes:
1. **Duration Decoupling & Truncation**: `voice_track.duration` is hardcoded to `0` in `CompositionHandler.ts`, `VoiceoverHandler` outputs `voice.scene_voiceovers` while `CompositionHandler` searches for `voice.voiceovers` (evaluating to undefined), and `encoder.py` computes `-t` from `sum(bg_tracks.duration)` rather than the true master audio duration.
2. **Template Layering Asymmetry**: `StickmanTemplate` (`CharacterRig.tsx`) renders only a transparent character with no background layer, while `DocumentaryTemplate` (`KenBurns.tsx`) renders the background internally inside Remotion, causing black frames when `background_tracks` are empty and breaking timeline preview consistency.
3. **Data Clumping & Naming Drift**: Inconsistent property names (`scene_voiceovers` vs `voiceovers`, `assetUrl` vs `asset_url` vs `asset_manifest.asset_slots.background.storage_key`, `duration` vs `duration_sec`) force fragile defensive fallbacks that silently fail to default values.
4. **Hardcoded Subtitle Geometry**: `SubtitleGenerator.py` hardcodes 9:16 vertical geometry (`PlayResX: 1080`, `PlayResY: 1920`, `MarginV: 280`) inside `.ass` headers, breaking subtitle positioning on 16:9 and 1:1 aspect ratios.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions:**
> 1. **Master Duration Contract**: The master audio track (`master_voice.mp3`) is the immutable single source of truth for the entire pipeline duration. All visual tracks (backgrounds, overlays, loops) and encoder `-t` limits will strictly anchor to `master_duration_seconds`.
> 2. **Remotion Background Layering**: `CharacterRig.tsx` will be updated to include an optional `BackgroundLayer` component (rendering stock image/video or ambient fallback), making Remotion output self-contained for timeline previews while preserving alpha compositing when desired.
> 3. **Clean Contract Schemas**: Replace ad-hoc dictionary property digging with standardized Pydantic models in Python and TypeScript interfaces in `@aiva/shared-types`.

---

## Proposed Changes

Grouped by component layer:

### 1. Shared Types & Contracts (`packages/shared-types`)

#### [MODIFY] [packages/shared-types/src/index.ts](file:///d:/repos/AIVA/packages/shared-types/src/index.ts)
- Add canonical `AssetRef`, `AssetManifest`, and `TimelineContract` interfaces.
- Standardize `VoiceoverScene` (`sequence_number`, `audio_url`, `duration_sec`, `word_timings`) and `SceneAssetData`.
- Deprecate flat aliases (`assetUrl`, `asset_url`, `assetRef`, `asset_ref`).

---

### 2. Python Workers Audio & Voiceover Stage (`apps/workers`)

#### [MODIFY] [apps/workers/app/pipelines/stage_handlers.py](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py)
- In `handle_voiceover_stage`: measure the exact duration of `master_voice.mp3` via `ffprobe` (or mutagen/wave/pydub/os audio probe) and return `master_duration_sec` alongside `master_audio_url` and normalized `voiceovers` list.
- In `handle_subtitle_extraction_stage`: ensure global word timings align with cumulative scene durations and master duration.

#### [MODIFY] [apps/workers/app/core/audio_utils.py](file:///d:/repos/AIVA/apps/workers/app/core/audio_utils.py)
- Add `get_audio_duration(file_path: str) -> float` helper using `ffprobe`.

---

### 3. Python Asset Resolution Pipeline (`apps/workers`)

#### [MODIFY] [apps/workers/app/providers/fallback_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/fallback_provider.py)
- Ensure `LocalSolidFallbackProvider` returns canonical metadata with valid MIME type, dimensions matching canvas config, and relative or absolute storage path.

#### [MODIFY] [apps/workers/app/routers/assets.py](file:///d:/repos/AIVA/apps/workers/app/routers/assets.py)
- Standardize output payload to emit canonical `asset_manifest` with guaranteed `background` slot and remove ambiguous aliases.

---

### 4. Node.js / TypeScript Orchestrator Handlers (`apps/web`)

#### [MODIFY] [apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts)
- Standardize state keys: populate both `voice.scene_voiceovers` and `voice.voiceovers` (and `voice.master_duration_sec`) to eliminate caller mismatches.
- Accurately sync `matchedScene.duration = vo.duration_sec` onto `context.state.scenes`.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/AssetHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/AssetHandler.ts)
- Validate that every scene has a valid `asset_manifest.asset_slots.background` before progressing to rendering.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/RenderHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/RenderHandler.ts)
- Pass canonical `assetUrl` and `duration` for each scene to `PipelineIR`.
- Ensure master timeline IR sets total duration matching `voice.master_duration_sec`.

#### [MODIFY] [apps/web/src/services/pipeline/handlers/CompositionHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts)
- Resolve `totalDuration` directly from `voice.master_duration_sec` (or sum of verified scene voiceover durations).
- Correct `voice_track.duration` from `0` to `totalDuration`.
- Eliminate defensive fallback property digging; consume canonical `asset_manifest` and `scene.duration`.

---

### 5. Template Renderer Engine (`apps/template-renderer`)

#### [MODIFY] [apps/template-renderer/src/templates/character-rig/CharacterRig.tsx](file:///d:/repos/AIVA/apps/template-renderer/src/templates/character-rig/CharacterRig.tsx)
- Add optional background layer rendering: if `currentScene?.assetUrl` is present, render `<Img>` / `<Video>` background layer with ambient lighting under the stickman SVG, with fallback gradient if no asset URL is provided.
- If transparency is explicitly requested (alpha overlay mode), retain transparent background.

#### [MODIFY] [apps/template-renderer/src/core/TimelineGenerator.ts](file:///d:/repos/AIVA/apps/template-renderer/src/core/TimelineGenerator.ts)
- Ensure timeline frame calculations strictly align scene start/end frames with exact voiceover scene durations.

---

### 6. FFmpeg Media Composition Engine (`apps/workers`)

#### [MODIFY] [apps/workers/app/core/composition/subtitle_generator.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/subtitle_generator.py)
- Make `.ass` header dynamic based on `CompositionModel.output_settings` (`width`, `height`, `aspect_ratio`).
- Calculate `PlayResX`, `PlayResY`, and safe-zone `MarginV` dynamically (e.g. 1920x1080 -> MarginV=120, 1080x1920 -> MarginV=280).

#### [MODIFY] [apps/workers/app/core/composition/graph_builder.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/graph_builder.py)
- Ensure background scaling and concatenation trim duration correctly matches total duration.
- When `background_tracks` is empty, generate synthetic styled dark ambient plate spanning exact `total_duration`.

#### [MODIFY] [apps/workers/app/core/composition/encoder.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/encoder.py)
- Anchor `-t` duration flag strictly to `model.voice_track.duration` (master audio duration) if present, falling back to background/overlay duration only when voiceover is absent.

#### [MODIFY] [apps/workers/app/core/composition/engine.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/engine.py)
- Compute `final_duration` using `voice_dur` (when `voice_track` exists) or `max(bg_dur, overlay_dur)`.

---

## Verification Plan

### Automated Tests
1. **Python Worker Test Suite**:
   ```powershell
   cd apps/workers
   .\venv\Scripts\pytest
   ```
2. **Template Renderer Type-Check & Bundle**:
   ```powershell
   pnpm --filter aiva-template-renderer type-check
   ```
3. **TypeScript / Monorepo Type-Check & Build**:
   ```powershell
   pnpm build
   ```

### End-to-End Pipeline Verification
1. **Offline Zero-Key Synthetic Generation**:
   - Run pipeline with mock/offline assets to verify `LocalSolidFallbackProvider` renders styled ambient gradient backgrounds (no black screen).
2. **Multi-Scene Duration & Subtitle Sync**:
   - Run a 3-scene 60s test video.
   - Verify with `ffprobe` that `composition.mp4` duration matches `master_voice.mp3` duration within ±0.1s.
   - Verify subtitles display until the final spoken word.
3. **Template Verification**:
   - Test both `stickman` and `documentary` video styles.
   - Verify stickman character is displayed over background media (or ambient gradient) and Ken Burns documentary pans/zooms over media.
