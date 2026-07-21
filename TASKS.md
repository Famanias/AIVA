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

## 12. CI & Pipeline-Level Testing

- [ ] Implement GitHub Actions CI (Lint → Type Check → Build → Docker)
- [ ] Implement full pipeline validation tests (Topic → IR JSON)


---

# Completed

- Initialized Monorepo, Database Schema, Authentication SSR, Provider Abstraction, Python Agent Chain, Audio Processing Pipeline, Template Renderer, Asset Pipeline, Pipeline Validation Framework, Media Composition Engine, and Telemetry/Cost Tracking.
