# Implementation Plan — Pivot to Self-Hosted, Fully Local AIVA Platform

Pivoting AIVA from a cloud multi-tenant SaaS platform into a self-hosted, fully local video production engine (inspired by tools like VidRush and Tofu Video). This pivot eliminates SaaS user authentication boundaries and cloud Supabase dependencies while enabling users to run 100% offline (Ollama, Kokoro, Whisper, local storage) or import their own cloud API keys (Gemini, Groq, OpenAI, Pexels, ElevenLabs) through an in-app Settings UI.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions (Aligned via `/grill-with-docs` Grilling Session):**
> 1. **Database & Direct Drivers:** Containerized PostgreSQL service (`postgres:16-alpine` with `pgvector` extension enabled via Docker Compose). Replaces `@supabase/supabase-js` and `supabase-py` with direct Postgres drivers (`pg` in Node.js / `asyncpg` in Python) for a lean, lightweight footprint without running PostgREST/Supabase containers.
> 2. **Authentication:** Auto-authenticated Single Local User mode (`local-user` / `default-workspace`). Next.js middleware automatically injects default session headers.
> 3. **Encrypted Provider & Key Management:** Interactive In-App Settings page (`/settings`) backed by an `app_settings` database table. API keys stored in `app_settings` are encrypted using AES-256 with a master key (`APP_SECRET`) defined in `.env`, with fallback to `.env` variables if settings are unconfigured in DB. Includes interactive connection & model availability checks for Ollama.
> 4. **Local Media Serving:** Next.js storage streaming API route (`/api/v1/storage/[...path]`) that streams local media files directly from `./storage/` to the dashboard player and Remotion renderer.
> 5. **Fully Containerized Docker Execution:** Complete service stack (`web`, `workers`, `template-renderer`, `postgres`, `redis`) orchestrated via `docker-compose up`.

---

## Proposed Changes

### 1. Infrastructure & Database Layer

#### [MODIFY] [docker-compose.yml](file:///d:/repos/AIVA/infra/docker-compose.yml)
- Add containerized PostgreSQL service (`postgres:16-alpine` with `pgvector` extension enabled).
- Expose Postgres port `5432` locally with persistent volume (`postgres_data`).
- Configure Python `workers` and `template-renderer` containers with volume mounts (`./storage:/app/storage`) and health-check dependencies on `postgres` and `redis`.

#### [NEW] [packages/database/src/local-db.ts](file:///d:/repos/AIVA/packages/database/src/local-db.ts)
- Implement a lightweight direct Postgres connection client using `pg` (Node.js) replacing Supabase client calls.

#### [NEW] [packages/database/migrations/20260812_app_settings.sql](file:///d:/repos/AIVA/packages/database/migrations/20260812_app_settings.sql)
- Add `app_settings` table to store encrypted API keys (AES-256), active provider selections (LLM, TTS, B-roll, Transcribe, Image Gen), and local model URLs (e.g., `ollama_base_url`).

#### [NEW] [packages/database/src/crypto.ts](file:///d:/repos/AIVA/packages/database/src/crypto.ts)
- Provide AES-256-GCM encryption and decryption helpers for reading/writing sensitive API keys to `app_settings` using `process.env.APP_SECRET`.

---

### 2. Frontend & API Layer (`apps/web`)

#### [MODIFY] [apps/web/src/middleware.ts](file:///d:/repos/AIVA/apps/web/src/middleware.ts)
- Bypass cloud Supabase Auth JWT checks in local self-hosted mode. Automatically inject single-user session headers (`x-user-id: local-user`, `x-workspace-id: default-workspace`).

#### [NEW] [apps/web/src/app/api/v1/storage/[...path]/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/[...path]/route.ts)
- Implement static streaming route handler to serve media assets stored in `./storage/projects/...` with range request support for video/audio streaming.

#### [NEW] [apps/web/src/app/(dashboard)/settings/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/settings/page.tsx)
- Build a responsive Settings UI allowing users to:
  - Enter, test, and save cloud API keys (Gemini, Groq, OpenAI, Pexels, ElevenLabs, Cloudflare).
  - Configure local model endpoints (Ollama host URL, model names) with interactive health-check buttons.
  - Select active default providers per pipeline stage.

#### [NEW] [apps/web/src/app/api/v1/settings/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/route.ts)
- Create GET/POST route handlers to read/write provider credentials with AES-256 encryption.

#### [NEW] [apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx)
- Build interactive Timeline Studio UI combining custom React 19 + Tailwind v4 multitrack scene editor with embedded `@remotion/player`.
- Allow users to scrub through scenes, preview voiceovers and visual prompts, edit text/image prompts per scene, and click "Re-render Scene".

#### [NEW] [apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts)
- Implement single-scene partial re-rendering endpoint. Only re-executes asset matching/generation + Remotion rendering + FFmpeg stitching for the edited scene, preserving all unchanged scene artifacts.

---

### 3. Backend & Python Workers (`apps/workers`)

#### [NEW] [apps/workers/app/db/local_db.py](file:///d:/repos/AIVA/apps/workers/app/db/local_db.py)
- Implement `asyncpg` connection pool replacing `supabase-py` client calls.

#### [NEW] [apps/workers/app/crypto/crypto.py](file:///d:/repos/AIVA/apps/workers/app/crypto/crypto.py)
- Implement AES-256 decryption helper in Python matching Node.js encryption algorithm (`cryptography` library / `AESGCM`).

#### [NEW] [apps/workers/app/providers/ollama_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/ollama_provider.py)
- Implement `OllamaProvider` adhering to `ILLMProvider` interface for running local LLMs via Ollama's HTTP API (`http://host.docker.internal:11434` / `http://localhost:11434`).

#### [NEW] [apps/workers/app/providers/local_storage_provider.py](file:///d:/repos/AIVA/apps/workers/app/providers/local_storage_provider.py)
- Implement `LocalStorageProvider` for saving generated voiceovers, video clips, preview frames, and final MP4 compositions directly to local disk (`./storage/projects/{project_id}/...`).

#### [MODIFY] [apps/workers/app/providers/registry.py](file:///d:/repos/AIVA/apps/workers/app/providers/registry.py)
- Update provider factory to dynamically query and decrypt credentials from `app_settings`, defaulting to `.env` if DB settings are absent.

### 4. Pipeline Checkpoint Resumability & Crash Recovery Strategy

#### [MODIFY] [apps/workers/app/orchestrator/engine.py](file:///d:/repos/AIVA/apps/workers/app/orchestrator/engine.py)
- Implement stage idempotency wrapper `load_checkpoint_or_run(project_id, stage_name, handler_func)`:
  - Before executing any stage (Research ➔ Outline ➔ Script ➔ Voiceover ➔ Subtitles ➔ Assets ➔ Remotion ➔ Composition), check if `./storage/projects/{id}/revisions/v{rev}/{stage_name}.json` exists and is valid.
  - If a valid artifact exists, log `stage_checkpoint_found` and skip execution, reusing the cached output payload.
  - If missing or invalid, execute the stage handler and persist the result immediately to `ArtifactRepository`.

#### [MODIFY] [apps/web/src/app/api/v1/projects/[id]/execute/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/[id]/execute/route.ts)
- Add `resume: boolean` parameter to project execution endpoint.
- When `resume: true` is sent, re-enqueue the job with the existing `revision` and `project_id`, enabling the worker orchestrator to pick up directly from the last failed stage with $0.00 repeated LLM/TTS API costs.

#### [MODIFY] [apps/web/src/app/(dashboard)/projects/[id]/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/page.tsx)
- Add job failure indicator and an interactive **"Resume Pipeline"** button when a job enters `failed` state.
- Display exact failure details (e.g., `Failed during stage: Voiceover — Ollama unreachable`) and current progress checkpoint.

---

### 5. Root Scripts & Documentation Updates

#### [MODIFY] [.env.example](file:///d:/repos/AIVA/.env.example)
- Add `APP_SECRET` (32-byte hex/string key for AES-256 encryption) and updated Postgres connection string (`postgresql://postgres:postgres@localhost:5432/aiva`).

#### [MODIFY] [package.json](file:///d:/repos/AIVA/package.json)
- Add `pnpm dev:local` and `pnpm setup:local` convenience commands.

#### [MODIFY] [docs/EDD.md](file:///d:/repos/AIVA/docs/EDD.md), [CONTEXT.md](file:///d:/repos/AIVA/CONTEXT.md)
- Update documentation to reflect the finalized Self-Hosted Local Architecture decisions.

---

## Verification Plan

### Automated Verification
1. **Database Migration & Crypto Test:**
   ```bash
   pnpm --filter database migrate
   ```
   Verify local Postgres schema is successfully instantiated with `app_settings` table and AES-256 crypto tests pass.

2. **Backend Worker Tests:**
   ```bash
   cd apps/workers && pytest
   ```
   Verify `asyncpg` queries, AES-256 credential decryption, provider abstraction fallback logic, and `LocalStorageProvider` write capabilities.

3. **Pipeline End-to-End Test:**
   ```bash
   pnpm test:pipeline
   ```
   Execute golden test suite verifying local execution from topic to rendered video output.

### Manual Verification
1. Run `docker-compose up -d` to bring up containerized stack (Postgres, Redis, Workers, Remotion, Web UI).
2. Open `http://localhost:3000` — confirm dashboard loads directly without login.
3. Navigate to `/settings` — test Ollama connection, enter test API keys, verify AES-256 encrypted persistence.
4. Trigger a video project generation — verify output video streams via `/api/v1/storage/...` route and plays in preview player.

