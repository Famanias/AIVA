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

---

# Assumptions

## AS-001 — Self-Hosted TTS is Sufficient

Kokoro-82M / Coqui TTS quality is deemed sufficient for narration-heavy automation content. Lower expressiveness is offset by pairing with animation/camera emphasis. Cloud TTS serves as automatic fallback only.

## AS-002 — P1 is Single-User

P1 has no multi-tenancy, no RBAC, no team features. A single workspace row, a single user. This simplification is deliberate to reduce scope.

## AS-003 — No Approval Gates in P1

The pipeline runs straight through in P1. Approval gates (post-script, pre-render) are a P2/P3 feature. This means P1 will consume compute on every submitted topic without human review.

## AS-004 — Sequential Processing on Single Box

In P1, Remotion/Chromium rendering, Whisper transcription, and SDXL image generation compete for the same CPU/GPU resources. Expect 20–35 minute total processing time per video. Parallel scene rendering across workers is a P3 capability.

## AS-005 — Baseline Stack Versions

The baseline environments are established as Node.js 20 (for Remotion/Next.js) and Python 3.11 (for FastAPI workers) managed via Docker containers.

---

# Implementation Notes

- **2026-07-18**: Successfully scaffolded the monorepo architecture. `shared-types` contains the canonical TS representations of the Supabase schema, which is pushed and active. Python workers and Remotion template rendering frameworks are built and running.
- **2026-07-18**: Completed Milestone 8 (Asset Pipeline), Milestone 9 (Validation Framework), and Milestone 10 (Media Composition Engine). The entire pipeline from AI text generation down to final MP4 encoding is proven and operational.
- **2026-07-18**: Completed Milestone 11 (Telemetry, Prompts & Cost Tracking), enabling non-blocking, system-wide observability and financial tracking.
- **2026-07-18**: Completed Milestone 12 (CI & Pipeline-Level Testing) with fully deterministic mock providers, Golden Suite versioning, and migration validation. **Phase 1 is officially complete.**

---

# Lessons Learned

_No lessons yet. This section will grow as the project encounters real-world challenges._

---

# Discoveries

_No discoveries yet. This section will capture unexpected findings during implementation._
