# AIVA

AIVA is a configurable AI video generation platform. Phase 1 focuses on fast, high-retention vertical short-form videos.

**Status**: Phase 1 (MVP) is fully implemented. The system successfully orchestrates a topic into a fully rendered, hardware-accelerated MP4 using deterministic AI agent chains, dynamic media composition, and self-hosted text-to-speech. The core architecture is completely modular and media-length agnostic, making it ready to support long-form generation in future phases.

## High-Level Architecture

The platform operates via an event-driven orchestration layer. The Next.js frontend acts as the dispatcher, writing to a standalone PostgreSQL database and dropping jobs into a Redis-backed BullMQ queue. A fleet of isolated Python and Node.js workers process these jobs stage-by-stage.

1. **AI Agent Chain**: Python workers execute Research, Outline, and Script generation using abstract LLM providers.
2. **Audio Pipeline**: Self-hosted TTS models (Kokoro/Coqui) generate narration, and Faster-Whisper extracts deterministic word-level timings.
3. **Asset Pipeline**: Semantic matching maps scenes to B-Roll via stock APIs, falling back to local SDXL image generation.
4. **Template Renderer**: A Node.js worker uses Remotion and Puppeteer to render transparent WebM layers (e.g., stickman rigs, documentary pans) based on the scene's visual type.
5. **Media Compositor**: A decoupled FFmpeg engine dynamically builds filter graphs to composite WebM layers, background music (auto-ducked), TTS audio, and burn-in subtitles into the final MP4.
6. **Telemetry & Validation**: All stages are strictly validated against a typed Intermediate Representation (PipelineIR) and tracked via a non-blocking OpenTelemetry-inspired cost ledger.

## Repository Structure

This is a Turborepo monorepo:

```
├── apps/
│   ├── web/                  # Next.js 16 Orchestrator & UI
│   ├── workers/              # Python FastAPI ML/AV Workers
│   └── template-renderer/    # Node.js Remotion worker
├── packages/
│   ├── database/             # PostgreSQL migrations, seed data, and connection pool
│   ├── shared-types/         # Cross-boundary TS interfaces
│   └── prompt-library/       # Versioned agent prompt templates
├── infra/                    # Docker Compose and deployment config
├── scripts/                  # CI utilities and Golden Suite certification
└── tests/                    # Golden Suite payloads and Python tests
```

## Technology Stack

- **Frontend**: Next.js 16, Tailwind v4
- **Database**: Standalone PostgreSQL 16 (with pgvector)
- **Queue**: BullMQ + Redis
- **Workers**: Python (FastAPI), Node.js (Remotion)
- **Video Processing**: FFmpeg (h264_nvenc / libx264)
- **AI/ML**: GenerativeAI (Gemini), Edge-TTS, Sentence-Transformers, Faster-Whisper

## Current Capabilities
- End-to-end deterministic video generation from a text topic.
- Extensible provider abstractions for LLMs, TTS, and Image generation.
- Two distinct rendering styles: Stickman Animation and Ken-Burns Documentary.
- Golden Suite CI certification pipeline running on GitHub Actions.
- Real-time cost tracking and non-blocking telemetry.
- Secure local artifact streaming (Media Proxy) for seamless dashboard previewing without cloud storage dependency.
- Native Windows FFmpeg composition support.

## Current Limitations
- **Single User / Single Box**: The MVP assumes a single tenant running on a single VPS. No RBAC or multi-tenancy is implemented yet.
- **Sequential Processing**: Scenes process sequentially in Phase 1. Parallel worker execution is slated for Phase 3.
- **No Human-in-the-Loop**: The pipeline runs straight through. Interactive timeline editing and approval gates are slated for Phase 2.

## How to Run Locally

### Prerequisites
- Node.js 20+
- pnpm 9+
- Python 3.11+
- Docker & Docker Compose
- FFmpeg

### Setup

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```

3. **Start Backing Services (PostgreSQL & Redis)**
   ```bash
   pnpm services:up
   ```

4. **Apply Database Migrations**
   ```bash
   pnpm db:migrate
   ```

5. **Run the Application**
   Use Turborepo to spin up the Next.js frontend, Python workers, and Remotion server:
   ```bash
   pnpm dev
   ```

### Certify the Pipeline

To verify the installation and orchestration logic without hitting live APIs, run the deterministic Golden Suite:
```bash
pnpm certify
```

## Future Roadmap (Phase 2+)

With the core short-form engine proven, the immediate focus shifts to **Publishing & Automation (Phase 2)**:
- Scheduled publishing to YouTube Shorts, TikTok, and Instagram Reels.
- Analytics and performance tracking.
- Automation for fully hands-off channel operations.
- Interactive Timeline Studio UI for manual scene editing and approval gates. 