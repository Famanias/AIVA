# Migration Walkthrough: Supabase to Local-First PostgreSQL

## Overview of Implementation

AIVA has been migrated from cloud Supabase to a **100% local-first, self-hosted architecture** running on **standalone PostgreSQL 16 (with `pgvector`)** and **Redis** via Docker Compose.

All `@supabase/*` SDKs, external cloud URLs, and remote auth requirements have been removed with zero runtime Supabase dependencies remaining in the application layer.

---

## Key Components Implemented

### 1. Infrastructure & Service Orchestration
- **[`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml)**: Canonical local backing store configured with `pgvector/pgvector:pg16` on port 5432 and `redis:7-alpine` on port 6379.
- **[`package.json`](file:///d:/repos/AIVA/package.json)**: Added service orchestration scripts:
  - `pnpm services:up`: Starts PostgreSQL and Redis containers in detached mode.
  - `pnpm services:down`: Tears down containers.
  - `pnpm services:logs`: Tails live logs for PostgreSQL and Redis.

### 2. Consolidated Migrations & Database Runner
- **[`packages/database/migrations/`](file:///d:/repos/AIVA/packages/database/migrations/)**: Consolidated all 8 SQL migrations into a single, clean directory:
  1. `20260718000000_core_schema.sql`
  2. `20260718115941_job_events.sql`
  3. `20260718120000_grants.sql`
  4. `20260719000000_add_assets_job_step.sql`
  5. `20260720000000_add_pipeline_logs.sql`
  6. `20260720100000_add_cancellation_states.sql`
  7. `20260720110000_add_pause_states.sql`
  8. `20260812000000_app_settings.sql`
- **[`packages/database/src/migrate.ts`](file:///d:/repos/AIVA/packages/database/src/migrate.ts)**: Updated path resolver to read directly from `../migrations` and `../seed.sql`.
- Removed legacy `supabase/` and `packages/database/supabase/` directories.

### 3. Local Authentication & Session Successor (`AIVA_AUTH_MODE`)
- **[`apps/web/src/lib/auth/session.ts`](file:///d:/repos/AIVA/apps/web/src/lib/auth/session.ts)**: Created self-hosted session management module supporting:
  - `AIVA_AUTH_MODE=local` (default): Zero-config single-user local development authenticated as `local@aiva.internal` (`00000000-0000-0000-0000-000000000000`).
  - `AIVA_AUTH_MODE=protected`: HMAC-SHA256 session tokens signed with `APP_SECRET` and stored in secure HTTP-only `aiva_session` cookies.
  - `getAuthenticatedUser(req)`: Standardized across all Next.js API route handlers.
- **[`apps/web/src/app/api/v1/auth/login/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/auth/login/route.ts)**: Local login route managing sessions and user entries.
- **[`apps/web/src/app/login/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/login/page.tsx)**: Modernized login page communicating directly with `/api/v1/auth/login`.
- **[`apps/web/src/proxy.ts`](file:///d:/repos/AIVA/apps/web/src/proxy.ts)**: Middleware injecting authenticated `x-user-id` and `x-workspace-id` headers.

### 4. REST Query & Telemetry Endpoints
- **[`apps/web/src/app/api/v1/projects/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts)**: Added `GET` endpoint querying `public.projects` with joined active `public.jobs`.
- **[`apps/web/src/app/api/v1/jobs/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/route.ts)**: Created `GET` endpoint for querying jobs.
- **[`apps/web/src/app/api/v1/jobs/[id]/events/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/%5Bid%5D/events/route.ts)**: Created `GET` endpoint returning job state, historical `job_events`, and real-time `pipeline_logs`.

### 5. Frontend Decoupling
- **[`apps/web/src/providers/OperationsDashboardProvider.tsx`](file:///d:/repos/AIVA/apps/web/src/providers/OperationsDashboardProvider.tsx)**: Replaced `createBrowserClient` and realtime channels with lightweight polling against `GET /api/v1/projects`.
- **[`apps/web/src/providers/DashboardProvider.tsx`](file:///d:/repos/AIVA/apps/web/src/providers/DashboardProvider.tsx)**: Replaced Supabase channels with polling against `GET /api/v1/jobs/[id]/events`.
- **[`apps/web/src/components/dashboard/SystemHealthPanel.tsx`](file:///d:/repos/AIVA/apps/web/src/components/dashboard/SystemHealthPanel.tsx)** & **[`apps/web/src/types/telemetry.ts`](file:///d:/repos/AIVA/apps/web/src/types/telemetry.ts)**: Updated health telemetry to monitor `postgres` instead of `supabase`.
- **[`apps/web/src/app/api/v1/jobs/{pause,resume,stop}/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/)**: Updated to use `getAuthenticatedUser(req)`.
- Uninstalled `@supabase/supabase-js` and `@supabase/ssr` from `apps/web/package.json`.

### 6. Documentation, CI & Architecture Alignment (Rule 12)
- **[`docs/adr/005-local-first-postgresql-migration.md`](file:///d:/repos/AIVA/docs/adr/005-local-first-postgresql-migration.md)** & **[`ADR.md`](file:///d:/repos/AIVA/ADR.md)**: Documented ADR-005.
- **[`README.md`](file:///d:/repos/AIVA/README.md)** & **[`SETUP.md`](file:///d:/repos/AIVA/SETUP.md)**: Updated prerequisites and instructions for `pnpm services:up` and `pnpm db:migrate`.
- **[`HOW_TO_OBTAIN_API_KEYS.md`](file:///d:/repos/AIVA/HOW_TO_OBTAIN_API_KEYS.md)**: Updated Section 1 for local PostgreSQL.
- **[`ARCHITECTURE.md`](file:///d:/repos/AIVA/ARCHITECTURE.md)** & **[`MEMORY.md`](file:///d:/repos/AIVA/MEMORY.md)**: Synchronized architecture diagrams and notes.
- **[`.github/workflows/ci.yml`](file:///d:/repos/AIVA/.github/workflows/ci.yml)**: Updated CI to run `docker compose up -d postgres redis` and `pnpm db:migrate`.
- **[`.env.example`](file:///d:/repos/AIVA/.env.example)**: Documented `DATABASE_URL` and `AIVA_AUTH_MODE=local`.
- **Deleted `db_dump.sql`**: Removed legacy dump containing Supabase-specific extensions.

---

## Automated Verification Results

| Verification Test | Command | Result |
|---|---|---|
| **Database Migration Runner** | `pnpm db:migrate` | ✅ **Passed**: All 8 migrations applied cleanly from `packages/database/migrations/`. |
| **Golden Suite Certifier** | `pnpm test:pipeline` | ✅ **Passed (5/5 Suites)**: Full unmocked pipeline execution (Brief, TTS, FFmpeg Composition, Single-Scene Re-render, Custom Script). |
| **Worker Pytest Suite** | `cd apps/workers && venv\Scripts\python.exe -m pytest tests/ -v` | ✅ **Passed (11/11 tests across 4 files)**: Audio ducking, SRT generation, word timings, AES encryption, and IR compatibility. |
| **Web Typecheck** | `pnpm --filter web exec tsc --noEmit` | ✅ **Passed (0 TypeScript errors)**. |
| **Next.js Production Build** | `pnpm --filter web build` | ✅ **Passed**: All static and dynamic routes compiled successfully with Turbopack. |
| **Zero Runtime Supabase Imports** | `git grep -i "@supabase" apps/` | ✅ **0 matches**. |
| **Zero Supabase Env References** | `git grep -i "NEXT_PUBLIC_SUPABASE" apps/` | ✅ **0 matches**. |

---

## Manual QA Validation Instructions

To manually test and verify the local-first PostgreSQL architecture on your machine, follow these steps:

### Step 1: Ensure Backing Services are Running
In your terminal, run:
```bash
pnpm services:up
```
*Verify that both `aiva-postgres` and `aiva-redis` are healthy.*

### Step 2: Apply Migrations
```bash
pnpm db:migrate
```
*Confirm output shows all 8 migrations and seed data applied successfully.*

### Step 3: Start the Development Server
```bash
pnpm dev
```

### Step 4: Validate Dashboard & REST Data Flow
1. Open your browser and navigate to `http://localhost:3000`.
2. Notice the Dashboard loads immediately without any cloud Supabase connection or login prompts (operating in `AIVA_AUTH_MODE=local`).
3. Check the **System Health** panel on the right: verify **PostgreSQL**, **Redis**, and **Python Worker** indicators are displayed and active.
4. Click **"New Project"**, enter a topic (e.g. *"The History of Space Exploration"*), and click **"Generate Video"**.
5. Observe the live generation pipeline:
   - Status updates in real-time on the project dashboard via local REST polling (`/api/v1/jobs/[id]/events`).
   - Progress bar updates as the pipeline moves from Research ➔ Script ➔ Voiceover ➔ Composition ➔ Completed.
6. Once complete, click the generated video to preview audio narration, dynamic visual overlay, and subtitles playing natively from local storage (`/api/v1/storage/...`).

### Step 5: Validate Single-Scene Re-render
1. From the project detail page, navigate to the **Timeline Studio** tab.
2. Edit the script text for Scene 1 and click **"Re-render Scene"**.
3. Confirm in the timeline that Scene 1 voiceover re-synthesizes and the master video re-stitches seamlessly.
