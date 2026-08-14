# Database Strategy & Migration Plan: Supabase to Local-First PostgreSQL (Revised)

## 1. Executive Summary & Review Synthesis

AIVA is a **local-first, self-hosted AI video production platform**. This revised plan addresses every finding identified in [`review-implementation-plan-verdict.md`](file:///d:/repos/AIVA/review-implementation-plan-verdict.md):

1. **Database Selection**: Reconfirms **Pure Local PostgreSQL 16 (with `pgvector`)** over SQLite. SQLite would require an 80–90% rewrite of the query layer, break Python `asyncpg` async pools, lose native `JSONB`/UUID/triggers, and create multi-process write-lock contention during parallel rendering.
2. **Infrastructure Canonical Source**: Reconciles Docker Compose by extending [`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml) (preserving `pgvector/pgvector:pg16` and Redis) instead of adding a conflicting root compose.
3. **Missing API Endpoints**: Explicitly specifies implementing `GET /api/v1/projects`, `GET /api/v1/jobs`, and `GET /api/v1/jobs/[id]/events` before replacing client-side Supabase SDK calls.
4. **Auth Replacement (Zero Regression)**: Replaces Supabase Auth with a lightweight, self-hosted session manager (`apps/web/src/lib/auth/session.ts`) supporting single-user zero-config local mode and cookie-signed auth for protected self-hosted setups.
5. **Safe Migration Restructuring**: Physically moves the 8 migration files and `seed.sql` to `packages/database/migrations/` and updates [`packages/database/src/migrate.ts`](file:///d:/repos/AIVA/packages/database/src/migrate.ts) atomically in the same step.
6. **Full Consumer Inventory**: Documents and decouples all 7 Supabase-dependent files across the frontend, telemetry, and job control routes.
7. **Documentation Synchronization (Rule 12)**: Synchronizes `SETUP.md`, `README.md`, `.env.example`, `ARCHITECTURE.md`, `docs/EDD.md`, and creates `docs/adr/005-local-first-postgresql-migration.md`.

---

## 2. Proposed Changes by Component

### Component 1: Infrastructure & Package Scripts (Reconciled)

#### [MODIFY] [infra/docker-compose.yml](file:///d:/repos/AIVA/infra/docker-compose.yml)
- Retain `pgvector/pgvector:pg16` and `redis:7-alpine` as the canonical local development & self-hosting backing store.
- Update comments and headers to clarify that database is local standalone PostgreSQL (not external Supabase).

#### [MODIFY] [package.json](file:///d:/repos/AIVA/package.json)
- Add top-level orchestration scripts targeting `infra/docker-compose.yml`:
  ```json
  "services:up": "docker compose -f infra/docker-compose.yml up -d postgres redis",
  "services:down": "docker compose -f infra/docker-compose.yml down",
  "services:logs": "docker compose -f infra/docker-compose.yml logs -f"
  ```

---

### Component 2: Unified Migrations in `@aiva/database`

#### [NEW DIRECTORY] `packages/database/migrations/`
- Move all 8 active migration files from `packages/database/supabase/migrations/` to `packages/database/migrations/`:
  - `20260718000000_core_schema.sql`
  - `20260718115941_job_events.sql`
  - `20260718120000_grants.sql`
  - `20260719000000_add_assets_job_step.sql`
  - `20260720000000_add_pipeline_logs.sql`
  - `20260720100000_add_cancellation_states.sql`
  - `20260720110000_add_pause_states.sql`
  - `20260812000000_app_settings.sql`

#### [MOVE] `packages/database/supabase/seed.sql` ➔ `packages/database/seed.sql`
- Move `seed.sql` to package root.

#### [MODIFY] [packages/database/src/migrate.ts](file:///d:/repos/AIVA/packages/database/src/migrate.ts)
- Update migration path resolver:
  ```ts
  const migrationsDir = path.join(__dirname, "../migrations");
  const seedPath = path.join(__dirname, "../seed.sql");
  ```

#### [DELETE] [supabase/](file:///d:/repos/AIVA/supabase) & [packages/database/supabase/](file:///d:/repos/AIVA/packages/database/supabase)
- Remove obsolete duplicate directories after physical migration.

---

### Component 3: Local Authentication Successor

#### [NEW] [apps/web/src/lib/auth/session.ts](file:///d:/repos/AIVA/apps/web/src/lib/auth/session.ts)
- Implement self-hosted session helper:
  - `getAuthenticatedUser(req: Request)`: Reads `x-user-id` header or `aiva_session` cookie. In development or single-user mode, defaults to `00000000-0000-0000-0000-000000000000` (`local@aiva.internal`).
  - `createSessionToken(user)` / `validateSessionToken(token)`: HMAC-SHA256 session token signed with `APP_SECRET`.

#### [NEW] [apps/web/src/app/api/v1/auth/login/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/auth/login/route.ts)
- Endpoint for local login verifying user in `auth.users` (or auto-authenticating default local admin) and setting `aiva_session` HTTP-only cookie.

#### [MODIFY] [apps/web/src/app/login/page.tsx](file:///d:/repos/AIVA/apps/web/src/app/login/page.tsx)
- Replace `@supabase/ssr` `signInWithPassword`/`signUp` with local `fetch('/api/v1/auth/login')`.

#### [MODIFY] [apps/web/src/proxy.ts](file:///d:/repos/AIVA/apps/web/src/proxy.ts)
- Extract session cookie or assign local default user ID to `x-user-id` header on incoming requests.

---

### Component 4: REST API Read/List Endpoints

#### [MODIFY] [apps/web/src/app/api/v1/projects/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts)
- Add `GET` handler: Queries `public.projects` joined with active `public.jobs` and returns `{ status: 'success', data: projects }` ordered by `created_at DESC`.

#### [NEW] [apps/web/src/app/api/v1/jobs/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/route.ts)
- Add `GET` handler: Queries `public.jobs` with filtering by project/status.

#### [NEW] [apps/web/src/app/api/v1/jobs/[id]/events/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/%5Bid%5D/events/route.ts)
- Add `GET` handler: Returns job status, recent `job_events`, and `pipeline_logs` for live dashboard telemetry.

---

### Component 5: Decouple Frontend Providers & Job Routes

#### [MODIFY] [apps/web/src/providers/OperationsDashboardProvider.tsx](file:///d:/repos/AIVA/apps/web/src/providers/OperationsDashboardProvider.tsx)
- Remove `createBrowserClient` and Supabase realtime channels.
- Implement data loader fetching from `GET /api/v1/projects` with lightweight 3s interval polling and manual `refresh()`.

#### [MODIFY] [apps/web/src/providers/DashboardProvider.tsx](file:///d:/repos/AIVA/apps/web/src/providers/DashboardProvider.tsx)
- Remove `createBrowserClient` and 4 Supabase channel subscriptions.
- Fetch active telemetry from `GET /api/v1/jobs/${jobId}/events` with 2s polling while job is running.

#### [MODIFY] [apps/web/src/components/dashboard/SystemHealthPanel.tsx](file:///d:/repos/AIVA/apps/web/src/components/dashboard/SystemHealthPanel.tsx) & [apps/web/src/types/telemetry.ts](file:///d:/repos/AIVA/apps/web/src/types/telemetry.ts)
- Replace Supabase indicator with `PostgreSQL Database` (`health.infrastructure.postgres`).

#### [MODIFY] [apps/web/src/app/api/v1/jobs/pause/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/pause/route.ts)
#### [MODIFY] [apps/web/src/app/api/v1/jobs/resume/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/resume/route.ts)
#### [MODIFY] [apps/web/src/app/api/v1/jobs/stop/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/stop/route.ts)
- Remove `@supabase/ssr` `createServerClient`. Use `getAuthenticatedUser(req)` for user verification.

#### [DELETE] [apps/web/lib/supabase/client.ts](file:///d:/repos/AIVA/apps/web/lib/supabase/client.ts)
#### [DELETE] [apps/web/lib/supabase/server.ts](file:///d:/repos/AIVA/apps/web/lib/supabase/server.ts)
#### [DELETE] [apps/web/lib/supabase/middleware.ts](file:///d:/repos/AIVA/apps/web/lib/supabase/middleware.ts)
- Delete unused legacy SDK wrappers.

#### [MODIFY] [apps/web/package.json](file:///d:/repos/AIVA/apps/web/package.json)
- Remove `@supabase/supabase-js` and `@supabase/ssr`.

---

### Component 6: Documentation & Architecture Alignment (Rule 12)

#### [NEW] [docs/adr/005-local-first-postgresql-migration.md](file:///d:/repos/AIVA/docs/adr/005-local-first-postgresql-migration.md) & [MODIFY] [ADR.md](file:///d:/repos/AIVA/ADR.md)
- Record architectural decision: deprecating Cloud Supabase in favor of standalone local PostgreSQL (`pg` + `asyncpg`).

#### [MODIFY] [README.md](file:///d:/repos/AIVA/README.md) & [SETUP.md](file:///d:/repos/AIVA/SETUP.md)
- Replace Supabase CLI setup steps with `pnpm services:up` and `pnpm db:migrate`.

#### [MODIFY] [.env.example](file:///d:/repos/AIVA/.env.example)
- Remove `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; document `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aiva`.

#### [MODIFY] [docs/EDD.md](file:///d:/repos/AIVA/docs/EDD.md)
- Reconcile §10, §12, §14, §39, §42, §43 to reflect local-first PostgreSQL architecture and local filesystem storage.

---

## 3. Verification & Acceptance Gates

| Test / Gate | Command | Acceptance Criteria |
|---|---|---|
| **Migration Runner** | `pnpm db:migrate` | All 8 migrations apply cleanly from `packages/database/migrations/`. |
| **Golden Pipeline Certifier** | `pnpm test:pipeline` | 5/5 test suites pass (Topic Brief, TTS, Voice Stitching, FFmpeg Composition, Single-Scene Re-render). |
| **Worker Pytest Suite** | `cd apps/workers && venv\Scripts\python.exe -m pytest tests/ -v` | 11/11 tests pass with asyncpg communicating with local PostgreSQL. |
| **Web Build & Typecheck** | `pnpm --filter web exec tsc --noEmit && pnpm --filter web build` | Next.js 16 compiles with 0 errors and zero Supabase imports. |
| **Zero Runtime Supabase Imports** | `git grep -i "@supabase" apps/` | Exactly 0 matches across `apps/web`, `apps/workers`, and `apps/template-renderer`. |
| **Frontend Live UI Check** | `pnpm dev` | Dashboard loads projects via `GET /api/v1/projects`, creation runs end-to-end, and status live-updates. |
