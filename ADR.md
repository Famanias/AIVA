# Architecture Decision Records (ADRs)

This document tracks the major architectural decisions made during Phase 1 of the AIVA platform.

---

## ADR 001: Next.js Orchestrator
**Context**: We needed a central control plane to handle user authentication, database writes, and job dispatching.
**Decision**: Use Next.js 16 with Supabase Auth.
**Consequences**: Clean separation of frontend UI and central API routing. Next.js becomes the state manager, dropping jobs into BullMQ, rather than executing long-running ML tasks itself.

## ADR 002: Python AI Workers
**Context**: The core pipeline relies heavily on LLMs, TTS models, Faster-Whisper, and semantic embeddings, which have mature Python ecosystems.
**Decision**: Implement the worker layer using Python and FastAPI.
**Consequences**: Excellent ML library support, but requires maintaining a polyglot monorepo (TS + Python) and strictly defining cross-language JSON contracts (`shared-types`).

## ADR 003: BullMQ & Redis
**Context**: Video rendering and AI generation are slow, stateful processes that require retries and resilience against worker crashes.
**Decision**: Use BullMQ backed by Redis for job queuing.
**Consequences**: Reliable exponential backoffs and dead-letter queues. The Next.js dispatcher and Python workers must both integrate with BullMQ.

## ADR 004: Supabase as the Database
**Context**: We need a relational database with built-in auth, RLS, and realtime capabilities for the dashboard.
**Decision**: Use Supabase (PostgreSQL).
**Consequences**: Rapid schema iteration and strong typed generation (`schema.ts`). We heavily leverage RLS to ensure zero-trust between tenants.

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
