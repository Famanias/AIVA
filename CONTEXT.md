# CONTEXT.md

> **Purpose**
>
> This document describes the current state of the AIVA project.
>
> It should be read at the beginning of every development session.
>
> It changes frequently as development progresses.

---

# Project Overview

AIVA is an AI-powered YouTube content production platform that automates the end-to-end pipeline from topic to published video.

The full architecture is defined in [docs/EDD.md](docs/EDD.md).

---

# Current Phase

**Phase 1 — Prove the Loop (Short-Form Engine) [✅ COMPLETE]**

The repository architecture is fully scaffolded. We have successfully implemented the core agent chain, database orchestration, the Remotion rendering engine, the asset pipeline, pipeline validation, the FFmpeg media composition engine, system telemetry, and a deterministic CI pipeline. Phase 1 targets short-form video generation (vertical 9:16) while keeping the infrastructure modular and media-length agnostic.

**Phase 2 — Publishing & Automation [🚧 IN PROGRESS]**

The next phase introduces publishing, scheduling, analytics, automation, and the interactive Timeline Studio UI with partial re-rendering and approval gates.

---

# What Exists

| Category | Status |
|---|---|
| Architecture Design | ✅ Complete — see [docs/EDD.md](docs/EDD.md) |
| Agent Behavior Rules | ✅ Complete — see [AGENTS.md](AGENTS.md) |
| Engineering Rules | ✅ Complete — see [RULES.md](RULES.md) |
| Project Context | ✅ Complete — this document |
| Engineering Memory | ✅ Complete — see [MEMORY.md](MEMORY.md) |
| Development Roadmap | ✅ Complete — see [ROADMAP.md](ROADMAP.md) |
| Implementation Backlog | ✅ Complete — see [TASKS.md](TASKS.md) |
| Security Documentation | ⬜ Not started |
| Application Code | ✅ Phase 1 Complete (Core AI, Rendering, Asset Pipeline, Validation, Composition, Telemetry) |
| Database Schema | ✅ Complete (Pushed to Supabase, Types Generated) |
| Infrastructure | ✅ Complete (Docker Compose, Env configured, GitHub Actions CI) |
| Tests | ✅ Complete (Golden Suite Certification, Unit, Integration) |

---

# Technology Stack

Defined in [docs/EDD.md §11](docs/EDD.md).

Summary:

- **Frontend:** Next.js 16, Tailwind v4, MUI
- **Database:** Supabase (PostgreSQL)
- **Queue:** BullMQ + Redis
- **Workers (ML/AV):** Python (FastAPI)
- **Template Rendering:** Remotion + Puppeteer (Node.js)
- **Final Rendering:** FFmpeg
- **TTS:** Kokoro-82M / Coqui (self-hosted)
- **Subtitles:** Faster-Whisper
- **Storage:** Supabase Storage / S3-compatible

---

# Active Decisions

The project has undergone a strategic pivot towards Short-Form content (30-120 seconds, vertical). This is treated as a product configuration change (`GenerationProfile` and `ContentStrategy`), **not** an architectural rewrite. The core pipeline remains media-length agnostic and is fully capable of supporting long-form documentaries in future phases without regressions.

The next step is to begin Phase 2 by implementing publishing automation and the interactive **Timeline Studio UI** to allow manual review and editing of scenes before full rendering.
---

# Known Blockers

None.

---

# Recent Changes

| Date | Change |
|---|---|
| 2026-07-18 | Initialized monorepo, database schema, Next.js, Python FastAPI workers, and Node Remotion renderer. |
| 2026-07-18 | Repository initialized with foundational documentation. |
| 2026-07-18 | Completed Milestone 7 (Template Framework), 8 (Asset Pipeline), 9 (Validation), 10 (Media Composition), 11 (Telemetry), and 12 (CI & Testing). Phase 1 is Complete. |
| 2026-07-20 | Resolved end-to-end pipeline execution failures (Groq rate limits, missing job_step enum, handler mismatches, Whisper model download stubbed). The pipeline successfully processes from topic to rendering stage. |
| 2026-07-20 | Implemented Queue Control System with cooperative cancellation spanning Node.js orchestrator and Python workers, backed by database state without duplicating sources of truth. |
| 2026-07-20 | Pivoted product focus to Short-Form vertical videos. Updated root documentation (EDD, Roadmap, Tasks, Rules, Agents, Readme) to reflect `GenerationProfile` and `ContentStrategy` abstractions, explicitly decoupling the pipeline architecture from video duration constraints. |
