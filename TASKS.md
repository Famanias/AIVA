# TASKS.md

> **Purpose**
>
> This document contains the active implementation backlog for the current phase.
>
> It focuses only on immediate work. Future-phase features belong in [ROADMAP.md](ROADMAP.md).
>
> Tasks should be updated as work progresses.

---

# Current Phase: P1 — Prove the Loop

Target: Topic → Hook → Retention Outline → Script → Scenes → Voiceover → Render → Downloadable MP4.

Two styles only: stickman animation + documentary.

Single user. Single VPS. No dashboard beyond status page + topic form. Phase 1 targets short-form video generation (vertical 9:16) via the ShortForm GenerationProfile, keeping the infrastructure entirely modular.

Reference: [docs/EDD.md §1.2, §7 FR-1 through FR-4, §9, §44](docs/EDD.md)

---

# Backlog

## 1. Project Scaffolding

- [x] Initialize monorepo structure per [docs/EDD.md §12](docs/EDD.md)
- [x] Set up `apps/web` (Next.js 16)
- [x] Set up `apps/workers` (Python/FastAPI)
- [x] Set up `apps/template-renderer` (Node.js, Remotion + Puppeteer)
- [x] Set up `packages/database` (Supabase schemas)
- [x] Set up `packages/shared-types` (TypeScript interfaces)
- [x] Set up `packages/prompt-library` (versioned prompt templates)
- [x] Set up `infra/docker-compose.yml` (local development stack)
- [x] Configure environment variables template (`.env.example`)

## 2. Database & Auth

- [x] Create core Supabase schema — projects, scenes, scene_versions, jobs, cost_ledger_entries, animation_rigs, video_style_presets
- [x] Create single workspace seed row (P1 simplification)
- [x] Set up Supabase Auth (email + password, single user)
- [x] Implement Next.js auth middleware (JWT validation)

## 3. Provider Abstraction Layer

- [x] Define TypeScript interfaces: `ILLMProvider`, `ITTSProvider`, `IStockProvider`, `IAnimationRenderer`, `IImageProvider`
- [x] Implement at least one concrete provider per interface for P1
  - [x] LLM: Gemini 1.5 Flash (or Groq)
  - [x] TTS: Kokoro-82M / Coqui (self-hosted)
  - [x] Stock: Pexels API
  - [x] Image: Cloudflare Workers AI SDXL
- [x] Implement provider selection via configuration

## 4. Queue System

- [x] Set up Redis instance
- [x] Configure BullMQ with single shared queue (P1 simplification)
- [x] Implement job enqueue from Next.js API
- [x] Implement worker job consumer
- [x] Implement retry with exponential backoff (base 2s, max 5 retries, jitter ±20%)
- [x] Implement job state persistence (`jobs` table)
- [x] Implement cooperative job cancellation and Queue Control UI (Node.js + Python)

## 5. Agent Chain (Python Workers)

- [x] Implement Research Agent (web search → source gathering)
- [x] Implement Outline Agent (sources → structured outline, style-aware)
- [x] Implement Script + Director Agent (combined LLM call: narrative text + scene visual_type/action/camera/transition/tone)
- [x] Refactor Prompt Library to use `ContentStrategy` abstraction (`ShortFormStrategy` vs `LongFormStrategy`).
- [x] Introduce `GenerationProfile` into the pipeline payload, removing hardcoded assumptions about duration and aspect ratio.
- [x] Update `ShortFormStrategy` prompt templates for High-Retention Pacing (Hook → Outline → Script → Scenes).
- [x] Validate JSON schema output from combined agent

## 6. Voice & Subtitle Pipeline

- [x] Implement TTS dispatch (scene-by-scene voiceover generation)
- [x] Implement loudness normalization (-16 LUFS per scene, -14 LUFS master)
- [x] Implement Faster-Whisper subtitle extraction (word-level timestamps)
- [x] Store word timings on `scenes.voiceover_word_timings`

## 7. Template Rendering Framework (Node.js Worker)

- [x] Create default stickman character rig template with system default actions
- [x] Create Ken-Burns photo/video template (documentary style)
- [x] Seed system default animation rigs and style presets
- [x] Implement template resolver (visual_type → correct Remotion component family)
- [x] Implement timeline generator (maps agent scenes to React sequences)
- [x] Implement Chromium pool management
- [x] Implement direct-to-WebM rendering via `renderMedia()` (VP9, alpha)

## 8. Asset Pipeline (B-Roll & Image)

- [x] Implement stock API query (Pexels/Pixabay plugin)
- [x] Implement semantic embedding-based B-roll matching (sentence-transformers)
- [x] Implement fallback to AI image generation (SDXL plugin)
- [x] Implement local asset caching (download, hash, dedup)

## 9. Pipeline Validation (Intermediate Representation)

- [x] Execute complete AI pipeline without FFmpeg composition
- [x] Output and validate a fully structured Intermediate Representation (timeline, voice, assets, subtitles)
- [x] Verify determinism of the rendering payload

## 10. FFmpeg Composition (Final Render)

- [x] Treat FFmpeg strictly as a deterministic compositor
- [x] Implement alpha-channel overlay compositing (character rig over background)
- [x] Implement multi-track audio mixing (voiceover + background music, auto-ducking)
- [x] Implement subtitle burn-in
- [x] Implement final MP4 encode (libx264/h264_nvenc)

## 11. Telemetry, Prompts & Cost Tracking

- [x] Implement prompt execution tracking (version, provider, model, tokens, time)
- [x] Populate `cost_ledger_entries` per stage
- [x] Expose queue wait time, stage duration, and provider latency in Dashboard

## 13. Deterministic Artifact Persistence & Resumability

- [x] Resolve HMR BullMQ worker duplication via `globalThis.__bullmq_worker` global singleton
- [x] Resolve EdgeTTS HTTP 403 & `httpx 0.28` proxy parameter conflicts (`edge-tts 7.2.8`, `httpx 0.27.2`)
- [x] Fix empty asset search queries (`query=""`) in `assets.py`
- [x] Fix SDXL provider placeholder URL to valid image service
- [x] Deduplicate composition progress logging streams in `engine.py`
- [x] Implement fallback voiceover duration measurement in `edge_tts_provider.py`
- [x] Implement `ArtifactRepository` for versioned Project Artifact Packages (`storage/projects/{id}/revisions/v{rev}/`)
- [x] Implement Checkpoint Resumability API (`POST /api/v1/projects/[id]/execute`) with zero LLM API calls required during rendering
- [x] Implement strongly typed `CanvasConfig` schema (`width`, `height`, `fps`, `aspect_ratio`) separating creative intent (`GenerationProfile`) from rendering geometry
- [x] Implement Remotion transparent VP9 WebM alpha export (`pixelFormat: 'yuva420p'`, `imageFormat: 'png'`) with preserved Webpack bundle caching
## 14. UI/UX Redesign (Dark Black/Red Theme & Design System)

- [x] Implemented Tailwind v4 CSS-first design tokens (`tokens.css`) with Syne, Inter, JetBrains Mono typography and black/red color palette
- [x] Implemented Radix UI primitives (`Button`, `Card`, `Input`, `Select`, `Modal`, `Toast`, `Tooltip`, `Dropdown`, `Tabs`, `Table`, `Progress`, `Avatar`, `Badge`, `Checkbox`, `Switch`, `Alert`, `Skeleton`, `EmptyState`)
- [x] Implemented App Shell (`Header`, `Footer`, `DashboardLayout`, `RootLayout`) with accessible skip links and responsive navigation
- [x] Redesigned Home Dashboard (`/`), Login/Signup (`/login`), Tabbed Settings console (`/settings`), Projects Catalog (`/projects`), Project Overview (`/projects/[id]`), and Timeline Studio (`/projects/[id]/timeline`)

## 15. Code Review Findings Remediation (V1 Hardening)

- [x] **F1 / F10 / J5**: Added auto-fallback to local Ollama (`llama3.2`) in `factory.py` when `api_key` is empty; cleaned dead synchronous provider wrappers and added warning for unknown providers
- [x] **F2**: Added `await` to rerender worker dispatch in `rerender/route.ts` and returned HTTP 502 with error details on failure
- [x] **F3 / J4**: Implemented full RFC-7233 byte-range parser in `storage/[...path]/route.ts` with suffix range (`bytes=-N`) support and deduplicated Node stream helpers
- [x] **F4 / F9**: Resolved absolute project storage paths via `get_storage_root()` in `storage.py` and `checkpoint.py`
- [x] **F5**: Replaced all raw `print()` statements with structured `structlog` logging in composition engine (`engine.py`, `encoder.py`, `subtitle_generator.py`)
- [x] **F6**: Modularized multi-scene voiceover concatenation in `audio_utils.py` with sanitized single quotes for FFmpeg concat demuxer
- [x] **F7**: Implemented parallel per-scene render dispatch in `RenderHandler.ts` and persisted individual scene `render_url` in PostgreSQL
- [x] **F8**: Implemented dynamic geometry extraction and visual scene re-rendering via `template-renderer` in `rerender_single_scene`
- [x] **F11**: Unified prompt duration pacing to check `duration_target_seconds` alongside `target_duration_seconds` in `prompts.py` and `stage_handlers.py`

## 17. Video Generation Architecture Deep Seam Remediation

- [x] **Canonical Seam Contracts (`@aiva/shared-types`)**: Defined canonical `AssetRef`, `AssetManifest`, `TimelineContract`, `VoiceoverScene`, and `CanvasConfig` interfaces in `packages/shared-types`.
- [x] **Master Audio Duration Contract**: Added exact audio duration probing (`get_audio_duration`) via `ffprobe` in `audio_utils.py` and returned `master_duration_sec` from `handle_voiceover_stage`.
- [x] **Duration Coupling & State Normalization**: Unified `VoiceoverHandler.ts` to populate `voice.voiceovers` and `voice.master_duration_sec`. Updated `RenderHandler.ts`, `CompositionHandler.ts`, `TimelineGenerator.ts`, and `encoder.py` to anchor duration directly to the master audio file.
- [x] **Self-Contained Stickman Template (`CharacterRig.tsx`)**: Embedded dynamic `BackgroundLayer` into `CharacterRig.tsx` that consumes scene media (`assetUrl`) with ambient dark gradient fallback, eliminating black frames in timeline preview and final render.
- [x] **Dynamic Canvas Subtitle Geometry (`subtitle_generator.py`)**: Parameterized ASS header with `PlayResX`, `PlayResY`, `MarginV`, and font size scaling dynamically derived from output resolution (9:16 vertical, 16:9 horizontal, 1:1 square).
- [x] **Windows Path Sanitization in `AssetDownloader`**: Fixed path and filename extraction in `AssetDownloader.download` to handle Windows backslashes and drive letter colons safely.

## 18. Dynamic Visual Selection (Decoupled Styles)

- [x] **AI Creative Director Autonomy (`prompts.py` & `script_director_agent.py`)**: Removed forced `VIDEO STYLE: stickman_animation` and hardcoded `visual_type_weights`. Empowered the LLM to choose between `broll`, `stock_photo`, `ai_image`, `ai_video`, and `kinetic_typography` per scene, generating both stock search keywords and generative AI prompts.
- [x] **Context-Aware Multi-Tier Asset Routing (`asset_strategy.py` & `assets.py`)**: Enhanced `AssetSelectionStrategy` to dynamically prioritize stock providers (`Pexels`, `Pixabay`) for stock video/photo scenes, and generative AI providers (`SDXL`, `Pollinations`) for AI imagery, with automatic graceful fallback.
- [x] **Universal Motion Engine Default (`RenderHandler.ts` & `KenBurns.tsx`)**: Defaulted rendering engine to the cinematic multi-asset Ken Burns template (`documentary`), providing smooth pan/zoom physics, looping video backgrounds, and subtitle contrast vignettes.
- [x] **API & Re-render Defaults (`projects/route.ts` & `rerender_scene.py`)**: Updated project creation and single-scene rerender endpoints to default `video_style` to `'documentary'`.

---

# Completed

- Initialized Monorepo, Database Schema, Authentication SSR, Provider Abstraction, Python Agent Chain, Audio Processing Pipeline, Template Renderer, Asset Pipeline, Pipeline Validation Framework, Media Composition Engine, Telemetry/Cost Tracking, Deterministic Project Artifact Persistence System with Checkpoint Resumability, Full Web App Redesign, V1 Code Review Remediation (F1-F11), Video Generation Pipeline Remediation (M1-M5), Video Generation Architecture Deep Seam Remediation (Section 17), and Dynamic Visual Selection (Section 18).




