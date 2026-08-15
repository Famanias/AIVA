# AIVA Video Generation Pipeline — Deep Diagnosis Report

**Branch:** `pivot-to-selfhosting-localfirst` (HEAD `0b24763`)  
**Date:** 2026-08-15  
**Purpose:** Cross-examine `pipeline_current_process_and_visual_plan.md` against the actual codebase; explain exactly how video is generated/composed; diagnose why output shows voiceover + fast subtitles that stop at ~10s with **no visual content** (black screen).

---

## Executive Summary

The reference document (`pipeline_current_process_and_visual_plan.md`) describes a **previous broken state** that was **already fixed on this branch** (commit `0b24763`). Its three claimed "defects" (path mismatch in `CompositionHandler`, transparent stub in `KenBurns.tsx`, wrong assetUrl path in `RenderHandler`) **do not exist in the current code** — the fixes are present and correct.

**However**, the reported symptom (voiceover + subtitles only, black video, subtitles cut off at ~10s) is **real and explained by three independent root causes that persist in the current codebase:**

| # | Root Cause | File / Lines | Symptom Explained |
|---|------------|--------------|-------------------|
| 1 | **Asset resolution silently fails** — no provider keys + Pollinations.ai unreachable → `asset_slots.background` empty → `background_tracks: []` → FFmpeg receives no stock video/images | `apps/workers/app/services/asset_strategy.py:26-75`<br>`apps/workers/app/providers/asset_providers.py:19-188` | **Black screen / no visuals** — only Remotion overlay renders (which defaults to transparent/black for `stickman` style) |
| 2 | **Video duration decoupled from audio** — `overlay=shortest=1` truncates video to min(bg_concat, overlay); overlay defaults to `10s`; `engine.py` computes `final_duration = max()` not `sum()` | `apps/workers/app/core/composition/graph_builder.py:67`<br>`apps/workers/app/core/composition/engine.py:68`<br>`apps/web/src/services/pipeline/handlers/CompositionHandler.ts:94` | **Subtitles stop at ~10s** — video ends early; audio (`master_voice.mp3` via `anull`) continues unbounded |
| 3 | **Default template is `stickman` (CharacterRig) — transparent overlay** — no background asset consumed; `KenBurns` (documentary) renders visuals but is only used when `video_style=documentary` | `apps/template-renderer/src/templates/character-rig/CharacterRig.tsx`<br>`apps/template-renderer/src/render-server.ts`<br>`apps/workers/app/pipelines/rerender_scene.py:268` | **Black/transparent canvas** behind audio — visual pipeline renders nothing |

---

## 1. Cross-Examination: `pipeline_current_process_and_visual_plan.md` vs. Actual Code

### Claim 1: "6 stages" in the pipeline
**REFUTED (minor).** The orchestrator registers **8 stage handlers** (`research → outline → script_direction → voiceover → subtitle_extraction → assets → rendering → composition`). The doc's "6 stages" is a coarse grouping (folds research+script into "Stage 1", voiceover+subtitles into "Stages 2&3"). The literal handler count is 8; `calculateProgress` references 14 step names (including unregistered `brand_safety_check`, `thumbnail`, `metadata`, etc.).

**Evidence:** `apps/web/src/services/pipeline/StageRegistry.ts:21-28`, `PipelineExecutor.ts:182-187`

### Claim 2: Defect #1 — `CompositionHandler.ts` queries `s.asset_manifest?.background?.storage_key` (missing `asset_slots`)
**REFUTED.** Current code reads the correct nested path **with fallbacks** (line 27):
```ts
const bgRef = s.asset_manifest?.asset_slots?.background || s.asset_manifest?.background || s.assetRef || s.asset_ref
```
The Python worker writes exactly `asset_manifest.asset_slots.background` (`apps/workers/app/routers/assets.py:38,44`). Path mismatch is fixed.

### Claim 3: Defect #2 — `KenBurns.tsx`/`CharacterRig.tsx` return transparent `<AbsoluteFill>`
**PARTIALLY TRUE but MISATTRIBUTED.** `KenBurns.tsx` (documentary composition) **correctly renders real assets** with spring-based Ken Burns motion (`<Video>`/`<Img>`, gradients, vignette). **However**, `CharacterRig.tsx` (stickman composition, the **default** `video_style`) returns:
```tsx
<AbsoluteFill style={{ backgroundColor: 'transparent' }} />
```
It never reads `model.scenes[].assetUrl`. The worker defaults `video_style` to `"stickman"` (`rerender_scene.py:268`), so jobs route to the transparent stub unless explicitly overridden.

### Claim 4: Defect #3 — `RenderHandler.ts` maps `s.assetUrl` instead of `asset_manifest.asset_slots.background.storage_key`
**REFUTED.** Current code (line 82) checks both:
```ts
assetUrl: s.assetUrl || s.asset_manifest?.asset_slots?.background?.storage_key || s.asset_manifest?.background?.storage_key || ''
```
Python `/assets/resolve` **also** sets `new_scene["assetUrl"] = candidate.reference.storage_key` (line 46), so `s.assetUrl` resolves identically. The nested path is present as fallback.

---

## 2. End-to-End Pipeline Architecture (Current State)

### 2.1 Orchestration Flow (8 Registered Stages)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE EXECUTOR (Next.js)                         │
│  Loads job → parses state_payload → runs handler → persists state → enqueues │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  RESEARCH     │           │  OUTLINE      │           │  SCRIPT       │
│  (topic→facts)│           │  (facts→plan) │           │  (plan→scenes)│
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VOICEOVER (EdgeTTS per scene) → master_voice.mp3 + per-scene word_timings  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBTITLE EXTRACTION (Faster-Whisper on each scene voiceover)               │
│  → global_word_timings (cumulative offsets) + per-scene word_timings        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ASSET RESOLUTION (Python worker /assets/resolve)                           │
│  Chain: Pexels → Pixabay → Pollinations.ai → SDXL (Pollinations Flux)       │
│  Output: scene.asset_manifest.asset_slots.background + scene.assetUrl       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RENDERING (Remotion template-renderer :3001)                               │
│  POST /render → PipelineIR (scenes[] with assetUrl, visual_type, action)    │
│  stickman (default) → CharacterRig.tsx → TRANSPARENT overlay               │
│  documentary      → KenBurns.tsx     → REAL visuals with Ken Burns motion  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPOSITION (Python worker /composition/composite → FFmpeg)                │
│  Inputs: background_tracks (from scenes), overlay_track (Remotion output),  │
│          voice_track (master_voice.mp3), word_timings (for subtitles)       │
│  Filtergraph: concat backgrounds → overlay=shortest=1 → burn ASS subtitles  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Structures (Critical Paths)

**Python `AssetManifest` → Web consumption:**
```python
# apps/workers/app/models/asset.py:23-26
class AssetManifest(BaseModel):
    asset_slots: Dict[str, AssetReference] = Field(default_factory=dict)  # {"background": AssetReference}
    alternatives: List[RankedCandidate] = Field(default_factory=list)

# apps/workers/app/routers/assets.py:31-48
manifest = AssetManifest(asset_slots={})
if candidate:
    manifest.asset_slots["background"] = candidate.reference  # ← KEY PATH
new_scene["asset_manifest"] = manifest.dict()
new_scene["assetUrl"] = candidate.reference.storage_key      # ← FLAT ALIAS
```

**Web `CompositionHandler` reads it correctly:**
```ts
// apps/web/src/services/pipeline/handlers/CompositionHandler.ts:27-28
const bgRef = s.asset_manifest?.asset_slots?.background || s.asset_manifest?.background || ...
const storageKey = bgRef?.storage_key || bgRef?.storageKey || s.assetUrl || s.asset_url || ''
if (!storageKey) return null  // ← SILENT DROP if empty
```

---

## 3. Why Visuals Are Missing (Black Screen) — Root Cause #1

### 3.1 Asset Resolution Can Silently Return Empty `asset_slots`

**File:** `apps/workers/app/services/asset_strategy.py:26-75`
```python
for provider in self.chain:  # [Pexels, Pixabay, Pollinations, SDXL]
    try:
        candidates = await provider.search(query)
        if not candidates:
            continue  # ← No candidates = try next provider
        # ... rank, score, threshold ...
    except Exception:
        continue  # ← ANY exception (network, 404, timeout) = try next provider
return None  # ← ALL providers exhausted/failing = None candidate
```

**Providers that can fail silently:**
| Provider | Failure Mode |
|----------|--------------|
| `PexelsProvider` | Returns `[]` if `PEXELS_API_KEY` missing (line 26-28) |
| `PixabayProvider` | Returns `[]` if `PIXABAY_API_KEY` missing (line 113-115) |
| `PollinationsProvider` | **Keyless but requires internet** — network error → exception → caught → continue |
| `SDXLProvider` | Same as Pollinations (actually returns Pollinations Flux URL) |

**Result:** In a self-hosted/offline/local-first setup with no PEXELS/PIXABAY keys, **asset resolution depends entirely on Pollinations.ai reachability**. If Pollinations is blocked/unreachable, every provider raises/returns empty, the chain returns `None`, and:
- `scene.asset_manifest.asset_slots` stays `{}`
- `scene.assetUrl` is **never set**
- `CompositionHandler` drops every scene (`storageKey === ''` → `return null`)
- `background_tracks: []` reaches FFmpeg

### 3.2 FFmpeg Composition With Empty Backgrounds

**File:** `apps/workers/app/core/composition/graph_builder.py:62-70`
```python
else:  # len(background_tracks) == 0
    current_bg = ""
...
if overlay_idx >= 0 and current_bg:
    filters.append(f"{current_bg}[{overlay_idx}:v]overlay=0:0:shortest=1[v_mixed]")
elif overlay_idx >= 0:
    video_out_pad = f"[{overlay_idx}:v]"  # ← ONLY the Remotion overlay
```

**File:** `apps/template-renderer/src/templates/character-rig/CharacterRig.tsx` (default composition):
```tsx
export const CharacterRig: React.FC<CharacterRigProps> = ({ model }) => {
  // ... NO asset consumption, NO <Img>/<Video>
  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }} />  // ← TRANSPARENT
  )
}
```

**Result:** Video = transparent Remotion overlay composited over nothing → **black screen**. Audio + subtitles still work because they come from independent `voice`/`subtitles` paths.

---

## 4. Why Subtitles Stop at ~10s — Root Cause #2

### 4.1 Video Duration Is Decoupled From Audio

**Three independent mechanisms truncate video to ~10s:**

| Mechanism | File / Lines | Effect |
|-----------|--------------|--------|
| `overlay=shortest=1` | `graph_builder.py:67` | Video ends at `min(bg_concat_duration, overlay_duration)` |
| `overlay.duration` defaults to `10.0` | `CompositionHandler.ts:94` | `scenes.reduce((acc, s) => acc + (s.duration \|\| 4.5), 0)` → if `scenes` empty or `s.duration` missing, defaults to `10.0` |
| `final_duration = max()` not `sum()` | `engine.py:68` | Metadata reports longest single scene (~10s) not total |

**Audio path is completely separate:**
```python
# audio_mixer.py:44-46
elif voice_idx >= 0:
    filters.append(f"[{voice_idx}:a]anull[outa]")  # ← Passes FULL master_voice.mp3 through
```
Encoder (`encoder.py:55-101`) issues **no `-shortest`**, **no `-t`**, no audio-driven duration. Audio plays to completion; video stops at ~10s. Burned subtitles vanish with the video.

### 4.2 Subtitle Timing Latent Bug (Can Compound the Issue)

**File:** `CompositionHandler.ts:79-83`
```ts
let wordTimings = voice.wordTimings || voice.word_timings || []
if ((!wordTimings || wordTimings.length === 0) && Array.isArray(voice.subtitles)) {
  wordTimings = voice.subtitles.flatMap((s: any) => s.word_timings || [])
}
```
- Primary: `voice.wordTimings` = **global** offsets (cumulative, built in `stage_handlers.py:250-254`)
- Fallback: flat-maps **per-scene local** timings (0-based per scene) → massive overlap/incorrect timing if global is missing

---

## 5. Template Renderer Defaults to Transparent Overlay — Root Cause #3

### 5.1 Two Compositions, Only One Renders Visuals

**File:** `apps/template-renderer/src/render-server.ts:71-74`
```ts
const composition = compositions.find(c => c.id === templateFamily)
// templateFamily comes from PipelineIR.templateFamily
```

**Registered compositions:**
| Composition ID | Component | Renders Visuals? |
|----------------|-----------|------------------|
| `documentary` | `KenBurns.tsx` | **YES** — `<Video>`/`<Img>`, Ken Burns motion, gradients |
| `stickman` | `CharacterRig.tsx` | **NO** — transparent `<AbsoluteFill>` only |

**Worker default:** `apps/workers/app/pipelines/rerender_scene.py:268`
```python
video_style = request.get("video_style", "stickman")  # ← DEFAULTS TO STICKMAN
```
Unless the job explicitly sets `video_style: "documentary"`, the render goes to `CharacterRig` → transparent overlay → black screen even if background tracks exist.

### 5.2 KenBurns.tsx Is Fully Functional (Refutes Doc Claim)
```tsx
// apps/template-renderer/src/templates/ken-burns/KenBurns.tsx:41-87
const assetUrl = model.scenes[0]?.assetUrl  // ← CONSUMES assetUrl
return (
  <Sequence from={0} durationInFrames={duration}>
    {assetUrl ? (
      isVideo ? (
        <Video src={assetUrl} style={videoStyle} />
      ) : (
        <Img src={assetUrl} style={imageStyle} />
      )
    ) : (
      // Dark ambient gradient fallback ONLY when no assetUrl
      <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)' }} />
    )}
    // Spring-based scale/translate, vignette, gradient overlay...
  </Sequence>
)
```

---

## 6. How Video Is Actually Generated & Edited — Step by Step

### Stage 1-3: Script → Voiceover → Subtitles (Python Worker)
1. **ScriptHandler** → `POST /pipeline/script_direction` → LLM breaks script into scenes with `visualType`, `animationAction`, `visualTags`
2. **VoiceoverHandler** → `POST /pipeline/voiceover` → EdgeTTS per scene → `master_voice.mp3` (concatenated) + per-scene `word_timings` (0-based) + `duration_sec`
3. **SubtitleHandler** → `POST /pipeline/subtitle_extraction` → Faster-Whisper re-transcribes each scene voiceover → builds **global** `word_timings` with cumulative offsets (`current_time_offset += duration`)

### Stage 4: Asset Resolution (Python Worker)
4. **AssetHandler** → `POST /assets/resolve` (sends entire state)
   - Strategy chain: Pexels → Pixabay → Pollinations → SDXL
   - Each provider: `search(query)` → rank by semantic similarity → download → validate → cache to `.cache/assets/<sha>.<ext>`
   - **Success:** `scene.asset_manifest.asset_slots.background = AssetReference{storage_key: "/abs/path", mime_type, ...}` + `scene.assetUrl = storage_key`
   - **Failure (all providers):** `asset_slots` stays `{}`, `assetUrl` unset

### Stage 5: Scene Rendering (Remotion Template Renderer)
5. **RenderHandler** → builds `PipelineIR` per scene with `assetUrl`, `visual_type`, `action` → `POST /render` to template-renderer
   - `templateFamily` = `video_style` (default `"stickman"`)
   - **stickman** → `CharacterRig.tsx` → transparent overlay webm
   - **documentary** → `KenBurns.tsx` → Ken Burns animated webm with asset
   - Returns `outputs.video` (local path to rendered overlay clip)

### Stage 6: Final Composition (Python Worker FFmpeg)
6. **CompositionHandler** → builds `CompositionModel`:
   - `background_tracks` from `scenes[i].asset_manifest.asset_slots.background` (falls back to `assetUrl`)
   - `overlay_track` = Remotion output (duration = sum of scene durations, defaults 10s)
   - `voice_track` = `master_voice.mp3`
   - `word_timings` = global timings for ASS subtitle generation
   - `POST /composition/composite`
7. **CompositionEngine** → `FilterGraphBuilder`:
   - Each background: `scale→crop→trim=duration→setpts`
   - `concat` all backgrounds (NO transitions/xfade)
   - `overlay=0:0:shortest=1` → truncates to shorter of bg_concat vs overlay
   - `subtitles='file.ass'` burn-in on result
   - `anull` passes master voice through unchanged
8. **Encoder** → `ffmpeg -map [v_subbed] -map [outa] -c:v libx264 -c:a aac output.mp4`
   - **No `-shortest`, no `-t`** → video length = filtergraph output; audio = full master_voice.mp3

---

## 7. Files & Lines to Fix (Prioritized)

### Priority 1: Guarantee Visual Content (Fix Black Screen)
| File | Lines | Fix |
|------|-------|-----|
| `apps/workers/app/services/asset_strategy.py` | 26-75 | Add **guaranteed fallback provider** (local curated assets / picsum.photos / generated solid color plate) that **never fails**; ensure `asset_slots.background` is always populated |
| `apps/workers/app/providers/asset_providers.py` | 156-188 | Make `PollinationsProvider` more resilient (retries, timeout, local mirror); add explicit "offline mode" with local SDXL/ComfyUI hook |
| `apps/template-renderer/src/templates/character-rig/CharacterRig.tsx` | ALL | **Consume `model.scenes[].assetUrl`** and render `<Img>`/`<Video>` background like `KenBurns`; keep character overlay on top |
| `apps/workers/app/pipelines/rerender_scene.py` | 268 | Change default `video_style` from `"stickman"` to `"documentary"` OR make stickman render backgrounds |

### Priority 2: Fix Duration Coupling (Fix 10s Cutoff)
| File | Lines | Fix |
|------|-------|-----|
| `apps/workers/app/core/composition/graph_builder.py` | 67 | Remove `shortest=1` from overlay; drive video duration from **audio length** (probe `master_voice.mp3` duration) |
| `apps/workers/app/core/composition/engine.py` | 68 | Change `final_duration = max(...)` to `sum(t.duration for t in model.background_tracks)` |
| `apps/web/src/services/pipeline/handlers/CompositionHandler.ts` | 94 | Ensure `overlay.duration` = sum of **actual** scene durations from voiceovers (not fallback 4.5) |
| `apps/workers/app/core/composition/encoder.py` | 55-101 | Add `-shortest` to ffmpeg cmd OR compute total duration and pass `-t <total_seconds>` |

### Priority 3: Subtitle Timing Robustness
| File | Lines | Fix |
|------|-------|-----|
| `apps/web/src/services/pipeline/handlers/CompositionHandler.ts` | 79-83 | **Remove the per-scene fallback**; require `voice.wordTimings` (global) — fail fast if missing |
| `apps/workers/app/pipelines/stage_handlers.py` | 271 | Guard `current_time_offset += duration` against `duration === 0` (would freeze subtitle timeline) |

### Priority 4: Portability & Observability
| File | Lines | Fix |
|------|-------|-----|
| `apps/workers/app/models/asset.py` + `asset_repository.py` | 56 | `storage_key` = absolute path → breaks in distributed topology; use **relative/storage-agnostic key** + resolver |
| `apps/workers/app/core/composition/encoder.py` | 59-62 | Video backgrounds: add `-stream_loop -1 -t <dur>` to loop/pad short clips to scene voice duration |

---

## 8. Verification Checklist (How to Confirm Fixes)

1. **Asset resolution never returns empty** — run `/assets/resolve` with no API keys, verify every scene gets `asset_manifest.asset_slots.background.storage_key`
2. **Video duration = audio duration** — generate a 3-scene video (~60s voiceover); verify `composition.mp4` duration ≈ `master_voice.mp3` duration (ffprobe)
3. **Subtitles span full video** — verify last subtitle `end` time ≈ video duration; no cutoff at 10s
4. **Visuals present** — `ffplay composition.mp4` shows stock video/photos/Ken Burns motion, not black
5. **Both template styles work** — test `video_style: "stickman"` AND `"documentary"`; both render backgrounds
6. **Transitions (optional)** — verify `xfade` or cross-dissolve between background clips (currently hard concat)

---

## 9. Conclusion

The `pipeline_current_process_and_visual_plan.md` accurately describes the **architecture** (8-stage flow, Python→Remotion→Python, asset_manifest threading) but its **defect claims are stale** — fixed in commit `0b24763`.

The **actual production bugs** causing your symptom are:

1. **Asset resolution has no guaranteed-success fallback** → empty backgrounds in offline/self-hosted setups
2. **Video duration is not anchored to audio** → `shortest=1` overlay + 10s default truncates visuals while audio plays on
3. **Default template (`stickman`) renders transparent** → even with backgrounds, the overlay is invisible; `KenBurns` works but isn't default

Fixing these three areas will produce full-length videos with stock footage/AI visuals, synchronized subtitles, and voiceover — matching the intended "rich, dynamic, multi-modal video production engine" vision.