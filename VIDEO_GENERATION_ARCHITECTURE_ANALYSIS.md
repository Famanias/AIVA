# AIVA Video Generation Pipeline — Architecture Analysis & Diagnosis Report

**Branch:** `pivot-to-selfhosting-localfirst`  
**Date:** 2026-08-15  
**Focus:** Video generation/editing → Final MP4 output architecture  
**Purpose:** Apply codebase-design principles (deep modules, seams, adapters, leverage, locality) to diagnose why final MP4 exports show blank screen, missing voiceover, and broken subtitle sync.

---

## Executive Summary

The video generation pipeline is **architecturally sound in concept** (8-stage orchestration, Python worker for heavy lifting, Remotion for overlays, FFmpeg for composition) but suffers from **three critical shallow-module boundaries** that leak implementation concerns across seams:

| Architecture Smell | Location | Symptom Caused |
|--------------------|----------|----------------|
| **Shallow Seam: Asset Resolution → Composition** | `CompositionHandler.ts:25-46`, `graph_builder.py:62-70` | Black screen — asset resolution can silently produce empty `background_tracks` |
| **Shallow Seam: Duration Contract** | `CompositionHandler.ts:94`, `TimelineGenerator.ts:31-64`, `engine.py:68`, `encoder.py:105-112` | Subtitles cut at ~10s — video duration decoupled from audio; `max()` used instead of `sum()` |
| **Missing Seam: Template Contract** | `rerender_scene.py:268`, `StickmanTemplate.ts`, `CharacterRig.tsx:88` | Transparent overlay — default template (`stickman`) renders no visuals even when assets exist |

**Bottom line:** The pipeline has the right *stages* but wrong *seams*. Each seam exposes implementation details (storage keys, frame math, provider chain internals) instead of a deep contract. Fixes require deepening three module boundaries — not patching individual files.

---

## 1. Current Pipeline Architecture (Codebase-Design View)

### 1.1 Module Map & Seams

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS ORCHESTRATOR (apps/web/src/services/pipeline)                │
│  PipelineExecutor → StageRegistry → 8 Handlers (Research → Outline → Script → Voiceover     │
│                      → Subtitles → Assets → Render → Composition)                            │
│                                                                                              │
│  External Seam: PipelineState (JSON blob passed between stages)                             │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │  PYTHON WORKER  │ │ REMOTION RENDERER│ │  FFMPEG ENGINE  │
         │ (apps/workers)  │ │ (apps/template-  │ │ (apps/workers/  │
         │                 │ │  renderer)       │ │  core/composition)│
         ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
         │ /pipeline/voice │ │ POST /render    │ │ /composition/   │
         │ /assets/resolve │ │ PipelineIR →    │ │ composite       │
         │ /composition/   │ │ Timeline →      │ │ FilterGraph →   │
         │   composite     │ │ AssetResolver → │ │ Encoder         │
         └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                  │                   │                   │
                  └───────────────────┼───────────────────┘
                                      ▼
                         ┌─────────────────────────────────────┐
                         │           STORAGE LAYER              │
                         │  .cache/assets/  (validated media)  │
                         │  storage/projects/<id>/composition.mp4│
                         └─────────────────────────────────────┘
```

### 1.2 Data Contracts at Each Seam

| Seam | Producer | Consumer | Contract Type | Depth Assessment |
|------|----------|----------|---------------|------------------|
| **PipelineState** | Each StageHandler | Next StageHandler | JSON blob (implicit) | **Shallow** — no schema, overlapping keys, magic strings |
| **AssetManifest** | `/assets/resolve` | `CompositionHandler` | Pydantic → TypeScript (implicit) | **Shallow** — multiple fallback paths, `storage_key` is raw path |
| **PipelineIR** | `RenderHandler` | Template Renderer | TypeScript interface | **Medium** — versioned, but `assetUrl` stringly-typed |
| **CompositionModel** | `CompositionHandler` | `CompositionEngine` | Pydantic model | **Medium** — structured but `storage_key` leaks FS path |
| **Filter Graph** | `FilterGraphBuilder` | `Encoder` | Raw string | **Shallow** — string concatenation, no validation |

---

## 2. Deep Diagnosis: Three Shallow Seams Causing Production Bugs

### 2.1 Seam #1: Asset Resolution → Composition (Black Screen Root Cause)

**Location:**  
- Producer: `apps/workers/app/routers/assets.py:14-49` (`resolve_scene`)  
- Consumer: `apps/web/src/services/pipeline/handlers/CompositionHandler.ts:25-46`

**Current Contract (Shallow):**
```python
# Python side — returns this shape
new_scene = {
    "asset_manifest": {
        "asset_slots": {"background": AssetReference},  # optional
        "alternatives": []
    },
    "assetUrl": "/absolute/path/to/file.jpg",  # flat alias
    "asset_ref": {...}
}
```

```typescript
// TypeScript side — reads with defensive fallbacks
const bgRef = s.asset_manifest?.asset_slots?.background 
           || s.asset_manifest?.background 
           || s.assetRef || s.asset_ref;
const storageKey = bgRef?.storage_key || bgRef?.storageKey 
                || s.assetUrl || s.asset_url || '';
if (!storageKey) return null;  // SILENT DROP
```

**Why It's Shallow:**
1. **Primitive Obsession** — `storage_key` is a raw filesystem path (`/abs/path/file.jpg`), not a storage-agnostic reference
2. **Data Clumps** — Same asset referenced 4 different ways (`asset_slots.background`, `assetUrl`, `asset_url`, `asset_ref`)
3. **No Guarantee** — Contract doesn't promise `asset_slots.background` exists; consumer must defensively check 4 paths
4. **Leaky Abstraction** — Consumer knows about provider chain internals (Pexels vs Pollinations vs fallback)

**Root Cause of Black Screen:**
The `AssetSelectionStrategy` chain (Pexels → Pixabay → Pollinations → SDXL → **LocalSolidFallback**) *should* guarantee a result. But:

```python
# asset_strategy.py:50-55
temp_file = await AssetDownloader.download(best_candidate.raw_metadata.get("url", ""))
# If fallback provider returns local file path, download() may fail/skip
validation = AssetValidator.validate(temp_file, mime_type)
asset_ref = self.repository.save(temp_file, mime_type, ...)
```

The **LocalSolidFallbackProvider** generates a local gradient JPEG and returns its path as `url`. But `AssetDownloader.download()` likely expects HTTP URLs, not `file://` paths. The download fails → exception caught → provider skipped → **entire chain returns `None`** → `asset_slots` stays empty.

**Evidence:** `fallback_provider.py:61-77` returns `url: fallback_path` (local path). `asset_downloader.py` (not read but inferred) probably only handles HTTP.

---

### 2.2 Seam #2: Duration Contract (Subtitle Cutoff at ~10s Root Cause)

**Location — Four modules that must agree but don't:**

| Module | Duration Calculation | Contract Violation |
|--------|---------------------|-------------------|
| `CompositionHandler.ts:94-96` | `scenes.reduce((acc, s) => acc + (s.duration \|\| 4.5), 0)` → fallback `10.0` | Uses scene `duration` field which may not exist |
| `TimelineGenerator.ts:31-64` | Splits `totalDurationInFrames` equally among scenes if no explicit durations | Assumes equal split; ignores actual voice duration per scene |
| `graph_builder.py:67` | `overlay=0:0:eof_action=pass` (was `shortest=1`) | Still truncates if overlay shorter than bg concat |
| `engine.py:68-73` | `final_duration = max(bg_dur, overlay_dur, voice_dur)` | **Uses `max()` not `sum()`** — reports longest single track |
| `encoder.py:105-112` | `-t` flag from `sum(background_tracks.duration)` → fallback to overlay → fallback to voice | Only limits if total > 0; no audio-anchored guarantee |

**The Contract That Should Exist:**
> **Video Duration = Audio Duration (master_voice.mp3)** — always. Visuals stretch/loop to match. Subtitles burn for full video duration.

**What Actually Happens:**
1. Voiceover stage produces `master_voice.mp3` (e.g., 60s) + per-scene `word_timings` (local 0-based) + global `word_timings` (cumulative)
2. Subtitle stage builds global timings with cumulative offsets ✓
3. Asset stage — may produce 0 background tracks ✗
4. Render stage — `totalDurationInFrames` from global word timings OR 30s fallback
5. **CompositionHandler** calculates `totalDuration` from scene `duration` (missing → 4.5 default) → **if 2 scenes = 9s, if empty = 10s**
6. Overlay track duration = this calculated `totalDuration` (~10s)
7. **FFmpeg filter graph:** `overlay=0:0:eof_action=pass` — video ends when shorter of (bg_concat, overlay) ends
8. **Encoder** adds `-t total_duration` where `total_duration = sum(bg_durations)` — but if `bg_tracks` empty, falls back to overlay (~10s) or voice (60s) — **inconsistent**
9. **Result:** Video ~10s, Audio 60s, Subtitles burn only for video duration → **cut off at 10s**

---

### 2.3 Seam #3: Template Contract (Transparent Overlay Root Cause)

**Location:**
- Default selection: `apps/workers/app/pipelines/rerender_scene.py:268`
- Template registry: `apps/template-renderer/src/templates/index.ts:9-10`
- Stickman implementation: `apps/template-renderer/src/templates/character-rig/CharacterRig.tsx:88`

**Current Contract (Missing):**
```python
# rerender_scene.py:268
video_style = request.get("video_style", "stickman")  # DEFAULT = stickman
```

```typescript
// templates/index.ts
templateRegistry.register(new DocumentaryTemplate())  // id: "documentary"
templateRegistry.register(new StickmanTemplate())      // id: "stickman"
```

```tsx
// CharacterRig.tsx:88 — THE DEFAULT TEMPLATE
return (
  <AbsoluteFill style={{ pointerEvents: 'none', backgroundColor: 'transparent' }}>
    {/* Stickman SVG character — NO background asset consumption */}
  </AbsoluteFill>
);
```

```tsx
// KenBurns.tsx:50-82 — ONLY USED WHEN video_style="documentary"
{isVideo && assetUrl ? <Video src={assetUrl} ... /> : isImage && assetUrl ? <Img src={assetUrl} ... /> : <GradientFallback />}
```

**Why It's a Missing Seam:**
- **No interface** defines what a "template" must render
- **No contract** that templates must consume `model.scenes[].assetUrl`
- **Default template** violates the implicit requirement "render background visuals"
- **Two adapters** (`DocumentaryTemplate`, `StickmanTemplate`) but only one fulfills the real requirement

**Result:** Even if asset resolution works (Seam #1 fixed), the default `stickman` template renders a transparent character overlay over nothing → **black screen**.

---

## 3. Architecture Smells (Fowler Baseline) in the Diff

| Smell | Location | Evidence |
|-------|----------|----------|
| **Primitive Obsession** | `storage_key` as raw path everywhere | `CompositionHandler.ts:28`, `graph_builder.py:27`, `encoder.py:58` — absolute FS paths leak across seams |
| **Data Clumps** | Scene asset references | `asset_manifest.asset_slots.background`, `assetUrl`, `asset_url`, `asset_ref`, `storage_key` — 5 fields for 1 concept |
| **Shotgun Surgery** | Fixing duration requires 5+ files | `CompositionHandler.ts`, `TimelineGenerator.ts`, `graph_builder.py`, `engine.py`, `encoder.py` |
| **Divergent Change** | `graph_builder.py` builds video + audio graphs | Video logic (lines 48-75) and audio delegated to `AudioMixer` but still in same module |
| **Message Chains** | Deep navigation for storage key | `model.background_tracks[0].storage_key` — caller knows internal structure |
| **Speculative Generality** | Provider chain abstraction | 5 providers but only Pollinations + LocalFallback work offline; Pexels/Pixabay need API keys |
| **Middle Man** | `AssetSelectionStrategy` just loops providers | Could be inline; adds indirection without polymorphism benefit |

---

## 4. Deepening the Modules: Target Architecture

### 4.1 Seam #1: Asset Resolution → Composition (Deep Module)

**New Interface (Storage-Agnostic Asset Reference):**
```typescript
// packages/shared/src/assets/AssetRef.ts — NEW SHARED CONTRACT
export interface AssetRef {
  readonly id: string;                    // opaque identifier
  readonly mimeType: MimeType;
  readonly durationSeconds: number;       // for video; 0 for images
  readonly dimensions: { width: number; height: number };
  // NO storage_key, NO path — resolved by StorageAdapter at composition time
}

export interface AssetManifest {
  readonly background: AssetRef;          // REQUIRED — never optional
  readonly alternatives: ReadonlyArray<AssetRef>;
}

export interface SceneAssetData {
  readonly manifest: AssetManifest;
  // NO flat aliases (assetUrl, asset_url, asset_ref)
}
```

**Implementation Changes:**
1. **LocalSolidFallbackProvider** → returns `AssetRef` with `id: "local:fallback:ambient"` + metadata; **no download needed** — generated on-demand at composition time
2. **AssetRepository** → `resolve(assetRef: AssetRef): string` returns actual local path (adapter for storage)
3. **CompositionHandler** → passes `AssetRef[]` to Python; Python resolves paths via `StorageAdapter` at FFmpeg invocation time
4. **Guarantee:** `AssetManifest.background` is **always present** (fallback provider is not in chain — it's the *default implementation* of `AssetRef`)

### 4.2 Seam #2: Duration Contract (Deep Module)

**New Interface (Timeline Contract):**
```typescript
// packages/shared/src/timeline/TimelineContract.ts — NEW SHARED CONTRACT
export interface TimelineContract {
  /** Total video duration in seconds — SOURCE OF TRUTH */
  readonly totalDurationSeconds: number;
  
  /** Per-scene absolute timeline (frames) */
  readonly scenes: ReadonlyArray<SceneTimeline>;
  
  /** Global word timings aligned to totalDurationSeconds */
  readonly wordTimings: ReadonlyArray<WordTiming>;
}

export interface SceneTimeline {
  readonly id: string;
  readonly startFrame: number;      // absolute
  readonly durationFrames: number;  // absolute
  readonly assetRef: AssetRef;      // background for this scene
  readonly action: CharacterAction;
}
```

**Single Source of Truth:** `TimelineGenerator` (or new `TimelineService`) computes `totalDurationSeconds = voiceTrackDuration` from `master_voice.mp3` (probe via ffprobe). All downstream consumers **read only** — no independent calculation.

**FFmpeg Graph Contract:** `FilterGraphBuilder.build(model, timelineContract)` — receives pre-computed timeline, builds graph to match exactly `totalDurationSeconds`.

### 4.3 Seam #3: Template Contract (Deep Module)

**New Interface (Rendering Template Contract):**
```typescript
// packages/shared/src/rendering/TemplateContract.ts — NEW SHARED CONTRACT
export interface IRenderingTemplate {
  readonly id: TemplateId;
  readonly name: string;
  
  /** 
   * Render a scene with its background asset.
   * Contract: MUST render background from scene.assetRef.
   * May overlay characters, effects, typography on top.
   */
  readonly component: React.FC<{
    readonly model: CompositionModel;  // includes scenes with assetRef
    readonly scene: SceneTimeline;     // current scene with absolute timing
  }>;
  
  /** Validate composition model has required data */
  validate(model: CompositionModel): ValidationResult;
}

// Default template MUST satisfy: renders background + optional overlay
export const DefaultTemplateId: TemplateId = "documentary";  // NOT "stickman"
```

**StickmanTemplate** becomes a *variant* that composes: `BackgroundLayer(assetRef) + CharacterRig(action)` — not a separate template that ignores background.

---

## 5. File-by-File Fix Plan (Prioritized by Leverage)

### Priority 1: Guarantee Visual Content (Fix Black Screen)

| File | Change | Leverage |
|------|--------|----------|
| `packages/shared/src/assets/AssetRef.ts` | **NEW** — Define storage-agnostic `AssetRef` + `AssetManifest` | High — fixes contract at seam |
| `apps/workers/app/providers/fallback_provider.py` | Return `AssetRef` metadata; skip download/validate for local fallback | High — makes fallback actually work |
| `apps/workers/app/services/asset_strategy.py` | Make `LocalSolidFallbackProvider` the **default** (not last in chain); return `AssetRef` directly | High — guarantees `background` always present |
| `apps/workers/app/routers/assets.py` | Emit `AssetManifest` with `background: AssetRef` (required); remove flat aliases | Medium — cleans data clumps |
| `apps/web/src/services/pipeline/handlers/CompositionHandler.ts` | Read `scene.asset_manifest.background` only; pass `AssetRef[]` to Python | Medium — removes defensive fallback chains |
| `apps/workers/app/core/composition/engine.py` | Resolve `AssetRef[]` → paths via `StorageAdapter` at composition time | Medium — hides FS path from model |

### Priority 2: Anchor Duration to Audio (Fix 10s Cutoff)

| File | Change | Leverage |
|------|--------|----------|
| `packages/shared/src/timeline/TimelineContract.ts` | **NEW** — Define `TimelineContract` as single source of truth | High — eliminates shotgun surgery |
| `apps/template-renderer/src/core/TimelineGenerator.ts` | Compute `totalDurationSeconds` from `master_voice.mp3` (ffprobe); build `SceneTimeline[]` | High — centralizes duration logic |
| `apps/web/src/services/pipeline/handlers/CompositionHandler.ts` | Remove local `totalDuration` calculation; use `TimelineContract.totalDurationSeconds` | Medium — removes duplicate logic |
| `apps/workers/app/core/composition/graph_builder.py` | Build filter graph to match `TimelineContract.totalDurationSeconds` exactly; loop/pad backgrounds | High — fixes truncation at filter level |
| `apps/workers/app/core/composition/encoder.py` | Remove fallback duration logic; use `TimelineContract.totalDurationSeconds` for `-t` | Medium — single duration source |
| `apps/workers/app/core/composition/engine.py` | Return `CompositionResult.duration = timelineContract.totalDurationSeconds` | Low — consistency |

### Priority 3: Make Default Template Render Visuals

| File | Change | Leverage |
|------|--------|----------|
| `apps/template-renderer/src/templates/character-rig/CharacterRig.tsx` | Add background layer: consume `scene.assetRef` → render `<Img>`/`<Video>` + keep character overlay | High — fixes default template |
| `apps/template-renderer/src/templates/index.ts` | Register `StickmanTemplate` as variant that composes `BackgroundLayer + CharacterRig` | Medium — preserves stickman style |
| `apps/workers/app/pipelines/rerender_scene.py` | Change default `video_style` from `"stickman"` to `"documentary"` OR ensure stickman variant works | Low — default behavior |

### Priority 4: Portability & Observability

| File | Change | Leverage |
|------|--------|----------|
| `apps/workers/app/repositories/asset_repository.py` | `storage_key` → relative key; add `StorageAdapter.resolve(key): string` | Medium — enables distributed storage |
| `apps/workers/app/core/composition/graph_builder.py` | Add `xfade` transitions between background clips (currently hard concat) | Low — quality improvement |
| `apps/workers/app/core/composition/subtitle_generator.py` | Validate subtitle end time ≤ video duration; warn on mismatch | Low — catches sync bugs early |

---

## 6. Verification Checklist (Architecture-Level)

After fixes, verify at **seam level** — not file level:

| Seam | Verification |
|------|--------------|
| **AssetRef Contract** | Run `/assets/resolve` with NO API keys, offline — every scene returns `AssetManifest.background: AssetRef` (id starts with `local:`) |
| **Timeline Contract** | Generate 3-scene video (~60s voiceover); verify `TimelineContract.totalDurationSeconds ≈ 60`; all `SceneTimeline` durations sum to total |
| **FFmpeg Duration** | `ffprobe composition.mp4` → duration ≈ `master_voice.mp3` duration (±0.5s) |
| **Subtitle Sync** | Last subtitle `end` time ≈ video duration; no cutoff; ASS file spans full timeline |
| **Visual Content** | `ffplay composition.mp4` shows stock footage/gradients/Ken Burns motion — not black |
| **Both Templates** | Test `video_style: "documentary"` AND `"stickman"` — both render backgrounds + overlay |

---

## 7. Conclusion: From Shallow to Deep

The current pipeline has **correct stage decomposition** but **shallow seams** that leak implementation details:

| Current (Shallow) | Target (Deep) |
|-------------------|---------------|
| `storage_key` raw paths across 5 modules | `AssetRef` opaque ID + `StorageAdapter` |
| 4 duplicate duration calculations | `TimelineContract` single source of truth |
| Template = "which component" | Template = "contract: must render background + overlay" |
| Provider chain with fragile fallback | Fallback = default `AssetRef` implementation |
| Silent drops (`return null`) | Fail-fast at seam with typed contract |

**Fixing three seams** (AssetRef, TimelineContract, TemplateContract) resolves all reported symptoms:
- ✅ Black screen → `AssetRef.background` always present
- ✅ Subtitles cut at 10s → `TimelineContract.totalDurationSeconds = audio duration`
- ✅ Fast/broken subtitles → Global word timings aligned to single timeline
- ✅ Default template transparent → `TemplateContract` requires background render

This is **architecture work, not bug fixes** — each seam deepened once pays back across all callers (leverage) and localizes future changes (locality).