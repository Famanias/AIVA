# Architecture Decision Records (ADRs)

This document tracks the major architectural decisions made during Phase 1 of the AIVA platform.

---

## ADR 001: Next.js Orchestrator & Local Auth Control Plane
**Context**: We needed a central control plane to handle user authentication, database writes, and job dispatching for local-first execution.
**Decision**: Use Next.js 16 with local session management (`AIVA_AUTH_MODE`).
**Consequences**: Clean separation of frontend UI and central API routing. Next.js becomes the state manager, dropping jobs into BullMQ, rather than executing long-running ML tasks itself.

## ADR 002: Python AI Workers
**Context**: The core pipeline relies heavily on LLMs, TTS models, Faster-Whisper, and semantic embeddings, which have mature Python ecosystems.
**Decision**: Implement the worker layer using Python and FastAPI.
**Consequences**: Excellent ML library support, but requires maintaining a polyglot monorepo (TS + Python) and strictly defining cross-language JSON contracts (`shared-types`).

## ADR 003: BullMQ & Redis
**Context**: Video rendering and AI generation are slow, stateful processes that require retries and resilience against worker crashes.
**Decision**: Use BullMQ backed by Redis for job queuing.
**Consequences**: Reliable exponential backoffs and dead-letter queues. The Next.js dispatcher and Python workers must both integrate with BullMQ.

## ADR 004: Standalone PostgreSQL Database (Supabase Deprecated)
**Context**: We need a local-first, self-hosted relational database with full ACID compliance, native JSONB querying, vector similarity search (`pgvector`), and multi-process concurrency across Next.js, FastAPI, and BullMQ without vendor lock-in.
**Decision**: Use standalone PostgreSQL 16 with `pgvector` via `infra/docker-compose.yml`.
**Consequences**: Full offline execution, zero external cloud database dependencies, unified TypeScript migration runner (`packages/database/src/migrate.ts`), and native connection pooling (`pg` + `asyncpg`). See `docs/adr/005-local-first-postgresql-migration.md`.

## ADR 005: Template Renderer Separation
**Context**: Rendering dynamic video frames programmatically is CPU intensive and relies on Chromium.
**Decision**: Isolate the rendering engine into a dedicated Node.js worker using Remotion and Puppeteer.
**Consequences**: The Python workers don't need Node.js/Chromium dependencies. The renderer is stateless and scales horizontally.

## ADR 006: FFmpeg Compositor
**Context**: We need to combine transparent WebM animations, ducked background music, TTS, and subtitles into a final MP4.
**Decision**: Implement a decoupled `CompositionEngine` in Python that builds FFmpeg filter graphs.
**Consequences**: FFmpeg commands are never built via string concatenation. The business logic outputs a `CompositionModel`, and the engine handles the complex graph math safely.

## ADR 007: Asset Repository Abstraction
**Context**: Finding B-roll requires searching providers (Pexels), semantic ranking, and falling back to AI image generation.
**Decision**: Create a distinct Asset Pipeline that decouples searching, ranking, and downloading into separate services.
**Consequences**: Easy to add new stock providers without touching the AI agent logic.

## ADR 008: Telemetry Architecture
**Context**: Tracking token costs and stage latencies is crucial to prevent runaway bills.
**Decision**: Implement a non-blocking `TelemetryClient` that writes OpenTelemetry-inspired Spans and Metrics.
**Consequences**: Business logic is clean. If telemetry fails, the video still renders. Cost calculation is strictly separated from the usage collection.

## ADR 009: PipelineIR (Intermediate Representation)
**Context**: The output of the AI agents must be deterministic before it hits the rendering engine.
**Decision**: Enforce a strict `PipelineIR` schema that acts as a contract between the AI layer and the rendering layer.
**Consequences**: We can completely mock the AI layer in CI and still test the renderer.

## ADR 010: CompositionModel
**Context**: The FFmpeg engine shouldn't know what a "scene" or "character" is.
**Decision**: Translate the `PipelineIR` into a `CompositionModel` (raw media tracks and timestamps) before invoking FFmpeg.
**Consequences**: True separation of concerns. The compositor is completely agnostic to the content style.

## ADR 011: Provider Abstraction
**Context**: LLM and TTS APIs change frequently and can go offline.
**Decision**: Never import provider SDKs directly in business logic. Always use `ILLMProvider` and `ITTSProvider`.
**Consequences**: We can swap Gemini for Groq, or use `MockLLMProvider` in CI without changing the orchestration code.

## ADR 012: Local Media Proxy (Dashboard UI)
**Context**: Modern browsers block web applications from securely loading raw local file paths (e.g., `C:\...`) to protect users, which prevents developers from viewing generated pipeline artifacts natively in the Next.js UI during local development.
**Decision**: Implement a dedicated Next.js API route (`/api/media?path=`) to act as a secure proxy that streams local filesystem media directly to the browser.
**Consequences**: Eliminates the need to upload intermediate artifacts to S3/Supabase Storage solely for developer preview. 

## ADR 013: Local TTS Fallback (EdgeTTS)
**Context**: High-fidelity TTS models like Kokoro-82M and Coqui are heavily dependent on PyTorch and CUDA. Running these locally alongside the LLM and Node processes frequently exhausts memory on developer machines, causing timeouts.
**Decision**: Configure the TTS provider abstraction to use `EdgeTTSProvider` during local development as a fallback, fetching synthesized speech via Microsoft's cloud API.
**Consequences**: Drastically reduces local machine load during development while maintaining accurate timing extraction for the FFmpeg pipeline, enabling faster end-to-end iteration.

## ADR 014: Deterministic Build & Artifact Package Architecture
**Context**: Regenerating expensive LLM, search, and TTS outputs during rendering or composition debugging wastes API tokens and slows down developer iteration.
**Decision**: Decouple the AI Generation Pipeline from the Rendering & Composition Pipeline. Save every stage output into a versioned, portable `Project Artifact Package` (`storage/projects/{id}/revisions/v{rev}/`).
**Consequences**: Rendering and composition become pure, deterministic build steps that consume persisted artifact packages with zero LLM API calls required. Enables checkpoint resumability (`POST /api/v1/projects/[id]/execute`).

## ADR 016: Strongly Typed CanvasConfig & Dynamic Resolution-Agnostic Rendering Engine
**Context**: Hardcoding video viewport dimensions (e.g. 1080x1920 portrait) across rendering and composition modules causes visual letterboxing, lower-half image clipping, and tight coupling to specific video formats.
**Decision**: Separate creative strategy (`GenerationProfile`) from pure rendering geometry (`CanvasConfig`). Express viewport geometry as strongly typed objects (`{ width, height, fps, aspect_ratio }`) passed across API boundaries. FFmpeg graph builder derives scaling (`scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1`), cropping, and overlay coordinates dynamically. Remotion exports transparent VP9 WebM with `pixelFormat: 'yuva420p'` and `imageFormat: 'png'`.
**Consequences**: Eliminates black letterboxing and lower-half canvas masking. The pipeline dynamically supports 9:16 Shorts (1080x1920), 16:9 YouTube (1920x1080), and 1:1 Square (1080x1080) video formats without hardcoded logic.


