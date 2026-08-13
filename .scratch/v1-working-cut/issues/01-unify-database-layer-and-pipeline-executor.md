# 01 Unify Database Layer and Pipeline Executor

Type: task
Status: resolved
Blocked by: none

## Question

How do we eliminate `@supabase/supabase-js` from `PipelineExecutor`, `jobs` API routes, and event logging, standardizing the entire orchestrator on `@aiva/database` (`pg.Pool`) and restoring tenant session security?

## Context

`projects/route.ts` and the Python worker write directly to local PostgreSQL, but `PipelineExecutor.ts` queries Supabase SDK using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. On a fresh clone, the executor throws "Failed to fetch job" because the job was written to local PostgreSQL where the executor never looks. Additionally, project creation dropped auth checks in favor of `LIMIT 1` or zero-UUID fallback.

## Acceptance Criteria

1. `PipelineExecutor` connects to PostgreSQL via `@aiva/database` (`query()`).
2. Job fetching, status updates, progress updates, state payload saving, and `job_events` insertion use parameterized SQL queries against local PostgreSQL.
3. All `api/v1/jobs/*` routes use `@aiva/database`.
4. Authentication check on project creation is restored.

## Answer

Resolved:
- `PipelineExecutor.ts`, `PipelineLogger.ts`, and `LifecycleService.ts` have been migrated to direct `@aiva/database` (`query()`) parameterized SQL operations.
- `PipelineContext.ts` interface no longer requires `SupabaseClient<Database>`.
- Project `execute` route (`/api/v1/projects/[id]/execute`) migrated to `@aiva/database`.
- Job control endpoints (`stop`, `pause`, `resume`) and `projects/route.ts` updated with robust user authentication and explicit error logging.

