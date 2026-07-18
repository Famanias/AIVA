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

**Phase 1 — Prove the Loop (MVP Implementation) [✅ COMPLETE]**

The repository architecture is fully scaffolded. We have successfully implemented the core agent chain, database orchestration, the Remotion rendering engine, the asset pipeline, pipeline validation, the FFmpeg media composition engine, system telemetry, and a deterministic CI pipeline.

**Phase 2 — Make It Usable [🚧 IN PROGRESS]**

The next phase introduces the interactive Timeline Studio UI, partial re-rendering, scene preview, and approval gates.

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

No active implementation decisions pending.

The next step is to begin Phase 2 by implementing the interactive **Timeline Studio UI** to allow manual review and editing of scenes before full rendering.
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
