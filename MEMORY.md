# MEMORY.md

> **Purpose**
>
> This document is the project's long-term engineering memory.
>
> It accumulates architectural decisions, lessons learned, implementation notes, assumptions, and discoveries throughout the project's lifecycle.
>
> Information recorded here should never be removed — only appended or annotated.

---

# Architectural Decisions

## AD-001 — Combined Script + Director Agent

The script generation and scene direction stages are handled by a single LLM call rather than separate passes. This eliminates an extra round-trip for information the model already has in context. The `IDirectorAgent` interface is preserved so a specific style can split it back out in the future without changing the pipeline shape.

Reference: [docs/EDD.md §16.1](docs/EDD.md)

## AD-002 — Direct-to-WebM Rendering

Template rendering outputs WebM (VP9, alpha) directly via Remotion's `renderMedia()`, skipping the PNG frame-sequence intermediate from v2.0. This eliminates the dominant disk I/O bottleneck on constrained VPS hardware. ProRes 4444 remains available as an opt-in for enterprise handoff.

Reference: [docs/EDD.md §19.4](docs/EDD.md)

## AD-003 — Style-Agnostic Renderer

The renderer is not a stickman engine. It is a general programmatic template engine where stickman rigs, Ken-Burns pan/zoom, kinetic typography, and avatar narration are all Remotion component families behind one `IAnimationRenderer` interface. Adding a new style means adding a template folder, not a new subsystem.

Reference: [docs/EDD.md §4.2](docs/EDD.md)

## AD-004 — Style Presets Are Data, Not Code

Video output styles are stored as database rows (`video_style_presets`) containing visual type weights, default rig/template references, and camera pacing. Style behavior is configured, not hardcoded.

Reference: [docs/EDD.md §4.3](docs/EDD.md)

## AD-005 — Cache Key Design

Render cache keys use `sha256(template_family + template_ref + params + timing_hash)`. This should be implemented from day one — retrofitting caching onto an already-built pipeline is significantly more expensive.

Reference: [docs/EDD.md §19.5, §49](docs/EDD.md)

## AD-006 — Cost Ledger from Day One

`cost_ledger_entries` should be populated from the first deploy, even in P1. Early cost instrumentation validates the cost model against reality and catches runaway provider bills before they become problems.

Reference: [docs/EDD.md §49](docs/EDD.md)

## AD-007 — Single VPS for P1

P1 ships as a single VPS running docker-compose. No horizontal scaling, no Kubernetes, no multi-node topology. This is intentional — the multi-worker fleet is a P3 capability.

Reference: [docs/EDD.md §42, §46](docs/EDD.md)

## AD-008 — Two Styles Only for P1

P1 supports only stickman animation and documentary styles. Kinetic typography and avatar narration are deferred to P2 and P4 respectively.

Reference: [docs/EDD.md §1.2](docs/EDD.md)

## AD-009 — Edge-TTS Fallback

To ensure the pipeline is robust against self-hosted Kokoro-82M/Coqui unavailability, the TTS provider abstraction includes a fallback to the `edge-tts` python package, providing high-quality voices out-of-the-box without API keys.

## AD-010 — Supabase MCP Integration

The project relies on the Supabase Model Context Protocol (MCP) server for deep integrations during development. Local database operations, schema definitions, and migration tracking are managed with the `supabase/agent-skills` package.

## AD-011 — Decoupled Media Composition Engine

FFmpeg is not invoked as a monolithic script. The video orchestration is decoupled into isolated, single-responsibility services (AudioMixer, SubtitleGenerator, FilterGraphBuilder, Encoder) that deterministically translate a strict `CompositionModel` into filter graphs. This prevents the renderer from leaking into business logic.

## AD-012 — Validation Framework Execution Modes

The pipeline certification testing supports a synchronous `FastMode` (direct sequential execution without queues) for rapid local development, alongside a `ProductionMode` (BullMQ) to guarantee true orchestration correctness.

## AD-013 — Telemetry as Non-Blocking Infrastructure

Telemetry is treated strictly as an infrastructure concern, entirely decoupled from business logic and cost accounting. The `TelemetryClient` enforces a hard rule: all tracking operations are wrapped in `try/except` blocks. If the metrics database goes down, the pipeline simply logs a warning and continues processing. It also passes an OpenTelemetry-inspired `TelemetryContext` to capture prompt versions and job execution boundaries.

## AD-014 — Cooperative Queue Cancellation

Cancellation is modeled as a robust, explicit state transition (`cancel_requested_at` in the database) rather than a simple boolean flag or UI action. Both the Node.js orchestrator (`PipelineExecutor`) and the Python workers (via `CancellationService`) cooperatively check this state. This prevents orphaned compute resources (LLM/TTS operations) and ensures a single source of truth without duplicating state (e.g., avoiding conflicting `status=processing` and `is_cancelled=true`).

Furthermore, cancellation is explicitly kept out of the `job_step` enum. `job_step` must only represent pipeline execution stages (e.g., research, outline, render). Job lifecycle events are modeled through explicit metadata (`cancelled_at`, `cancel_reason`) and the project `video_status`. This preserves semantic meaning and simplifies debugging (e.g. "cancelled during render").

## AD-015 — Media-Length Agnostic Architecture

The platform was pivoted to focus on Short-Form content (30-120s) for Phase 1 MVP, but the pipeline architecture remains strictly media-length agnostic. Hardcoded assumptions about video duration, aspect ratio, scene counts, or prompt chaining are banned from the core infrastructure. Instead, pipeline executions are parameterized by a `GenerationProfile` (defining duration, platform, aspect ratio, and pacing) and driven by a `ContentStrategy` (e.g., `ShortFormStrategy` vs `LongFormStrategy`). This preserves long-form readiness without regressing the architecture.

## AD-016 — Local Media Proxy (Dashboard)

Modern browsers block web applications from loading local file paths (e.g. `C:\...` or `file:///`) for security reasons. To allow developers and operators to preview generated artifacts (audio, video, images) directly from the Next.js Dashboard UI without uploading them to cloud storage, a dedicated Next.js API route (`/api/media?path=`) serves as a local proxy, streaming file streams directly to the browser's media tags.

---

# Assumptions

## AS-001 — Self-Hosted TTS is Sufficient

Kokoro-82M / Coqui TTS quality is deemed sufficient for narration-heavy automation content. Lower expressiveness is offset by pairing with animation/camera emphasis. Cloud TTS serves as automatic fallback only.

## AS-002 — P1 is Single-User

P1 has no multi-tenancy, no RBAC, no team features. A single workspace row, a single user. This simplification is deliberate to reduce scope.

## AS-003 — No Approval Gates in P1

The pipeline runs straight through in P1. Approval gates (post-script, pre-render) are a P2/P3 feature. This means P1 will consume compute on every submitted topic without human review.

## AS-004 — Sequential Processing on Single Box

In P1, Remotion/Chromium rendering, Whisper transcription, and SDXL image generation compete for the same CPU/GPU resources. Because Phase 1 targets short-form video (30-120 seconds), expect < 3 minute total processing time per video. Parallel scene rendering across workers is a P3 capability for scaling and long-form workflows.

## AS-005 — Baseline Stack Versions

The baseline environments are established as Node.js 20 (for Remotion/Next.js) and Python 3.11 (for FastAPI workers) managed via Docker containers.

---

# Implementation Notes

- **2026-07-18**: Successfully scaffolded the monorepo architecture. `shared-types` contains the canonical TS representations of the Supabase schema, which is pushed and active. Python workers and Remotion template rendering frameworks are built and running.
- **2026-07-18**: Completed Milestone 8 (Asset Pipeline), Milestone 9 (Validation Framework), and Milestone 10 (Media Composition Engine). The entire pipeline from AI text generation down to final MP4 encoding is proven and operational.
- **2026-07-18**: Completed Milestone 11 (Telemetry, Prompts & Cost Tracking), enabling non-blocking, system-wide observability and financial tracking.
- **2026-07-18**: Completed Milestone 12 (CI & Pipeline-Level Testing) with fully deterministic mock providers, Golden Suite versioning, and migration validation. **Phase 1 is officially complete.**
- **2026-07-20**: Stubbed the `faster-whisper` model download in the `SubtitleExtraction` stage to prevent massive model initialization delays and failures during MVP testing. Fixed API endpoint mismatches (Worker wrapper format) in the `assets` step and successfully pushed the full AI pipeline through to the `rendering` step.
- **2026-07-20**: Implemented a comprehensive Queue Control System allowing single, selected, and bulk pipeline cancellations. Added `IQueueManager` abstraction, UI contextual bulk actions, and cross-language cooperative cancellation logic using a database-backed `cancel_requested_at` timestamp.
- **2026-07-20**: Refined Queue Control System schema definitions. Separated the concept of execution stage (`job_step`) from job lifecycle events (cancellations). Added explicit `cancelled_at`, `cancel_reason`, and `cancel_requested_by` metadata fields to the `jobs` table to preserve a complete audit trail without mutating active pipeline stages.
- **2026-07-20**: Pivoted MVP focus to short-form video generation while explicitly preserving the modular, media-length agnostic pipeline architecture. Introduced `GenerationProfile`, `PlatformProfile`, and `ContentStrategy` abstractions into the architectural documentation to ensure generation defaults are configurable rather than hardcoded.
- **2026-07-21**: Debugged a critical pipeline failure at the FFmpeg composition stage. The composition engine executed inside a rogue background Docker container due to a port 8000 binding conflict, causing Windows file paths (e.g., `D:\repos\...`) to fail validation because the Linux container could not resolve them. Stopped the container, shifted the Python worker natively to Windows, implemented dynamic path resolution for the dummy TTS audio files, and installed FFmpeg via `winget` to successfully satisfy pipeline validation.
- **2026-07-22**: Resolved duplicate BullMQ worker instantiation caused by Next.js HMR by binding `Worker` to `globalThis.__bullmq_worker`. Upgraded `edge-tts` to `7.2.8` to fix breaking Microsoft WebSocket 403 handshake changes, and pinned `httpx` to `0.27.2` to resolve `openai 1.51.0` `proxies=` keyword argument incompatibilities. Corrected Supabase JWT service role key authentication in `.env`.
- **2026-07-22**: Fixed semantic video rendering issues. Resolved multi-scene background track letterboxing and bottom-clipping by introducing aspect ratio scaling, cropping, and sample aspect ratio normalization (`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`) in `graph_builder.py`. Concatenated multi-scene audio narrations in `CompositionHandler.ts` and downloaded real 9:16 stock media images into `sample_project_artifact.json`, producing high-definition 4.3 MB master vertical MP4 videos (`master_...mp4`).
- **2026-08-14**: Completed migration from Supabase to Standalone Local PostgreSQL 16 (with `pgvector`) and local session management (`AIVA_AUTH_MODE=local`). Replaced Supabase Client/Realtime in web providers with REST polling and SSE, consolidated 8 migrations under `packages/database/migrations/`, updated `migrate.ts` runner, decoupled auth in job routes, and completely uninstalled `@supabase/*` SDKs. Zero runtime Supabase dependencies remaining.
- **2026-08-15**: Fixed 11 code review findings (F1-F11) across Python workers, Next.js API routes, and composition engine. Implemented empty-key local Ollama auto-fallback, RFC-7233 range stream parser with suffix range support, deterministic storage root resolution, unified duration target naming, modular audio concatenation helper with FFmpeg demuxer escaping, structured `structlog` logging in composition engine, parallel per-scene template rendering, and visual overlay re-rendering in single-scene rerender. Verified with 33/33 pytest pass and clean monorepo `pnpm build`.

---

# Architectural Decisions

## AD-019 — Standalone Local-First PostgreSQL & Local Session Authentication

AIVA is 100% self-hosted and local-first. Cloud Supabase dependencies have been removed. PostgreSQL 16 (with `pgvector`) runs locally via `infra/docker-compose.yml` (`pnpm services:up`) and migrations are applied directly via `pnpm db:migrate`. Frontend state synchronization uses native REST polling endpoints (`/api/v1/projects`, `/api/v1/jobs/[id]/events`), and user authentication uses lightweight session tokens with local fallback (`local@aiva.internal`). See ADR-005.

## AD-020 — LLM Factory Zero-Configuration Local Ollama Fallback

When `llm_provider` is `openai_compatible` but `llm_api_key` is empty (such as in fresh clones before user configuration), `get_llm_provider_async()` automatically falls back to `OllamaProvider(base_url="http://localhost:11434", model="llama3.2")` with a warning log, ensuring local-first generation works out of the box without crashing on missing keys.

## AD-021 — Parallel Per-Scene Render Dispatch & Visual Rerendering

`RenderHandler` dispatches single-scene `PipelineIR` payloads to `template-renderer` in parallel via `Promise.all`, persisting each scene's individual transparent WebM overlay path into `public.scenes.render_url`. When scenes are edited in the Studio UI, `rerender_single_scene` re-synthesizes voiceover, invokes `template-renderer` for the modified scene's visual overlay, and re-stitches master composition using cached assets.

## AD-022 — Multi-Scene Master Overlay & Guaranteed Fallback Composition Architecture

To prevent video truncation caused by per-scene overlay scoping, `RenderHandler` generates a continuous full-timeline `masterIR` across all scenes for the master composition overlay (`master_overlay.webm`), while maintaining parallel single-scene renders for timeline editor preview cache. `AssetSelectionStrategy` includes a guaranteed local solid/gradient canvas provider (`LocalSolidFallbackProvider`), `FilterGraphBuilder` injects a synthetic background canvas when background tracks are empty, and `Encoder` loops video backgrounds (`-stream_loop -1`) with explicit `-t` total duration anchoring. Subtitle generation applies phrase-chunking (2–4 words per dialogue line) for optimal viewer retention.

## AD-023 — Deep Seam Contracts & Audio-Anchored Video Composition

The pipeline architecture has been hardened with deep seam contracts across `@aiva/shared-types`, Python workers, Node.js orchestrator, Remotion renderer, and FFmpeg compositor:
1. **Master Duration Contract**: The master audio track (`master_voice.mp3`) is the single immutable source of truth for duration (`master_duration_sec`), probed directly via `ffprobe`. All downstream stages (`TimelineGenerator`, `RenderHandler`, `CompositionHandler`, `Encoder`) anchor to this duration, preventing video/audio/subtitle cutoff.
2. **Self-Contained Template Layering**: `CharacterRig.tsx` incorporates an active `BackgroundLayer` rendering scene media (`assetUrl`) with dark ambient gradient fallback, ensuring Remotion outputs and single-scene timeline previews are complete and free of black frames.
3. **Dynamic Canvas Subtitle Rendering**: `SubtitleGenerator` computes `.ass` subtitle safe zones (`PlayResX`, `PlayResY`, `MarginV`) and typography size dynamically from `CanvasConfig`, ensuring crisp alignment across 9:16, 16:9, and 1:1 viewports.

---

# Discoveries

- **Groq API Rate Limits**: `llama-3.3-70b-versatile` has strict 100k Tokens-Per-Day (TPD) limits, which get exhausted very quickly in a full pipeline test. Switching to `llama-3.1-8b-instant` provides a separate, faster quota (though still subject to 6,000 Tokens-Per-Minute limits for large requests). The pipeline MUST gracefully handle or backoff on HTTP 429/413 rate limit errors from Groq.
- **Next.js 16 Proxy Convention**: Next.js 16 Turbopack replaces `middleware.ts` with `src/proxy.ts`. Attempting to define both triggers a build-time fatal error (`middleware-to-proxy`). `src/proxy.ts` must remain the single entrypoint for auth token extraction and proxy headers.
- **Windows Path Formatting in Asset Downloader**: Windows file paths containing drive letters (e.g. `C:\...`) require sanitizing file basenames when copying local assets into temp cache directories to avoid `OSError: [Errno 22]` colons in destination paths.



