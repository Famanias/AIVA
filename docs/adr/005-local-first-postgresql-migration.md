# ADR 005: Standalone Local-First PostgreSQL & Deprecation of Cloud Supabase

## Status
Accepted

## Context
AIVA is pivoting from a SaaS cloud model to a 100% local-first, self-hosted content generation platform. The platform previously utilized Supabase for database hosting, Auth, and Storage.

However, running Supabase in a local-first environment introduced significant overhead:
1. Cloud Supabase introduced external network latency, remote authentication tokens, and vendor lock-in.
2. The core data layer was already accessing PostgreSQL directly via Node `pg` pools (`@aiva/database`) and Python `asyncpg` pools (`apps/workers`).
3. Storage had already migrated to the local filesystem (`storage/projects/{id}`).
4. Queue orchestration had already migrated to local Redis + BullMQ.

Evaluation between embedded SQLite and standalone PostgreSQL:
- **SQLite**: Would require rewriting 80–90% of raw SQL queries in TypeScript and Python, replace `asyncpg` with `aiosqlite`, eliminate native `JSONB`, UUID generation, and custom triggers, and create `SQLITE_BUSY` multi-process write contention during parallel video rendering (Next.js server + BullMQ worker + FastAPI worker + Remotion).
- **PostgreSQL 16 (with `pgvector`)**: Native MVCC multi-process concurrency, zero query rewrites, native JSONB support, and lightweight deployment via Docker Compose (`infra/docker-compose.yml`) or native service.

## Decision
1. **Database Engine**: Adopt standalone PostgreSQL 16 (with `pgvector`) as the single relational database engine.
2. **Deprecate Supabase SDKs**: Completely uninstall `@supabase/supabase-js` and `@supabase/ssr`.
3. **Local Authentication Successor**: Implement lightweight session management (`src/lib/auth/session.ts`) controlled by `AIVA_AUTH_MODE=local` (defaulting to local user `local@aiva.internal`).
4. **Unified Migration Runner**: Consolidate all 8 database migrations under `packages/database/migrations/` executed via `pnpm db:migrate`.
5. **Orchestration**: Standardize Docker Compose backing services under `infra/docker-compose.yml` (`postgres` + `redis`) accessible via `pnpm services:up`.

## Consequences
- **Positive**: Zero external cloud dependencies, offline execution capability, zero query rewrites, fast local query execution, unified migration system.
- **Negative**: Self-hosted deployments require running PostgreSQL and Redis (via `docker compose` or system services).
