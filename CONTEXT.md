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

**Self-Hosted Local-First Pivot [✅ COMPLETE]**

The system has been fully pivoted to a 100% self-hosted, local-first deployment architecture:
- **Containerized PostgreSQL 16 + pgvector**: Running locally via Docker Compose on port 5432 with healthchecks and persistent volume mounts.
- **Direct Database Access**: Replaced cloud Supabase SDKs with direct PostgreSQL connection pools (`pg.Pool` in `@aiva/database` for Node.js, `asyncpg` for Python workers).
- **In-App Encrypted Credentials**: Store API keys and provider selections in `app_settings` PostgreSQL table, encrypted with AES-256-GCM via `APP_SECRET`.
- **Media Range Streaming API**: Built Next.js `/api/v1/storage/[...path]` route streaming local `./storage/projects/...` assets with HTTP range request support (`206 Partial Content`).
- **Disk Stage Checkpoint Recovery**: Saved stage checkpoints to `./storage/projects/{id}/revisions/v{rev}/checkpoint_{stage}.json` for $0.00 repeated LLM/TTS costs on crash retries.
- **Offline Local AI Models**: Added `OllamaProvider` (`http://localhost:11434`) for 100% local offline LLM inference.
**Version 1 MVP Release [✅ COMPLETE]**

The platform has reached 100% Version 1 MVP completion:
- **Single-Scene Partial Re-Rendering**: Integrated inline prompt & narration text editing into Timeline Studio (`/projects/[id]/timeline`), queueing targeted single-scene rerenders while preserving unchanged scene clip checkpoints.
- **Production Dockerization**: Added multi-stage `Dockerfile` manifests for Python workers (`python:3.11-slim` + FFmpeg + Whisper), Node.js template renderer (`node:20-slim` + Chromium), and Next.js web application (`node:20-alpine`).
- **Asset Export & Downloads**: Added native browser file downloads (`Content-Disposition: attachment`) for MP4 compositions, SRT subtitles, and script JSON checkpoints from the Project Overview dashboard (`/projects/[id]`).

**Phase 2 — Publishing & Automation [🚧 UP NEXT]**

The next phase introduces publishing, scheduling, analytics, automation, and expanding the Timeline Studio UI with live Remotion player scrubbing and approval gates.

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
| Security Documentation | ✅ Complete — see [SECURITY.md](SECURITY.md) |
| Application Code | ✅ Complete (Core AI, Rendering, Asset Pipeline, Validation, Composition, Telemetry, Self-Hosted Local Stack) |
| Database Schema | ✅ Complete (Migrated to containerized PostgreSQL 16 + pgvector) |
| Infrastructure | ✅ Complete (Containerized Docker Compose stack with postgres, redis, web, workers, template-renderer) |
| Tests | ✅ Complete (Phase 1 DB, Phase 2 Web API, Phase 3 Python workers, Phase 4 E2E Integration Suite) |

---

# Technology Stack

Defined in [docs/EDD.md §11](docs/EDD.md).

Summary:

- **Frontend:** Next.js 16, Tailwind v4, Lucide Icons
- **Database:** Containerized PostgreSQL 16 + `pgvector` (`pg` Pool in TS, `asyncpg` in Python)
- **Encryption:** AES-256-GCM via `APP_SECRET` for local `app_settings` API keys
- **Queue:** BullMQ + Redis 7
- **Workers (ML/AV):** Python 3.11 (FastAPI, asyncpg, httpx)
- **Template Rendering:** Remotion + Puppeteer (Node.js)
- **Final Rendering:** FFmpeg
- **TTS:** EdgeTTS / Kokoro-82M (self-hosted) / ElevenLabs
- **Local AI:** Ollama (`http://localhost:11434`)
- **Subtitles:** Faster-Whisper
- **Storage:** Local filesystem (`./storage/projects/...`) streamed via Next.js `/api/v1/storage/[...path]` with HTTP range requests

---

# Active Decisions

The project has completed a pivot to a 100% **Self-Hosted Local-First Architecture** eliminating external cloud database and cloud storage runtime dependencies. The core pipeline remains media-length agnostic and is fully capable of supporting long-form documentaries in future phases without regressions.

The next step is to begin Phase 2 by implementing publishing automation and expanding the **Timeline Studio UI** to allow manual review and editing of scenes before full rendering.

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
| 2026-07-21 | Debugged and resolved Windows local development pathing and composition errors caused by rogue Docker container conflicts and missing local FFmpeg binaries. |
| 2026-07-21 | Finalized MVP end-to-end pipeline execution on Windows. Implemented Next.js local media proxy for dashboard artifact previews and switched to EdgeTTS to bypass heavy local ML inference during development. |
| 2026-07-22 | Resolved HMR worker duplication (BullMQ global singleton) and EdgeTTS 403 / httpx 0.28 dependency conflicts (`edge-tts 7.2.8`, `httpx 0.27.2`). Corrected Supabase JWT service role key authentication in `.env`. Implemented Deterministic Project Artifact Package architecture (`storage/projects/{id}/revisions/v{rev}/`) and checkpoint resume API (`POST /api/v1/projects/[id]/execute`) with zero LLM API calls during rendering. |
| 2026-07-22 | Designed and implemented strongly typed `CanvasConfig` rendering geometry engine (`width`, `height`, `fps`, `aspect_ratio`). Decoupled creative strategy (`GenerationProfile`) from viewport geometry. Enabled Remotion transparent VP9 WebM alpha export (`pixelFormat: 'yuva420p'`, `imageFormat: 'png'`) and dynamic FFmpeg scaling (`scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1`), eliminating black letterboxing and lower-half canvas masking across 9:16 Shorts (1080x1920) and 16:9 YouTube (1920x1080) video formats. |
| 2026-08-12 | Executed 4-phase pivot to 100% Self-Hosted Local-First Architecture: containerized PostgreSQL 16 + pgvector (`aiva-postgres` on port 5432), direct `pg` / `asyncpg` pool drivers, local AES-256-GCM encrypted `app_settings` credentials table, `/api/v1/storage` range-streaming route, disk stage checkpoint recovery system, local Ollama LLM provider, `/settings` management UI, and `/projects/[id]/timeline` studio page. |
| 2026-08-13 | Phase 6 — Container Build & Dockerfile Repair (commit `262b9c5`): upgraded `.dockerignore` to globstar patterns (build context 724 MB → 4.74 MB), fixed `apps/web/Dockerfile` cross-workspace type-import COPYs, fixed `apps/workers/Dockerfile` CMD + removed `brave-search` dep. All three images (`infra-workers`, `infra-web`, `infra-template-renderer`) now build successfully — template-renderer migrated to pnpm with monorepo build context (`workspace:*` protocol requires pnpm, not `npm install`) and copies `tsconfig.base.json`. |
