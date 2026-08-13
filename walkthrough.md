# Walkthrough — Milestone 1: Unify Database Layer & Pipeline Executor

## Summary of Changes

Milestone 1 resolves **Ticket 01** by eliminating `@supabase/supabase-js` from the critical execution path:
- **`PipelineExecutor.ts`**: Replaced all Supabase SDK queries with direct, parameterized PostgreSQL queries using `@aiva/database` (`query()`). Job fetching, progress updates, state payload persistence, and event logging now run exclusively against local PostgreSQL.
- **`PipelineLogger.ts` & `LifecycleService.ts`**: Standardized on `@aiva/database`, inserting into `public.pipeline_logs` and querying `public.jobs` directly.
- **`PipelineContext.ts`**: Removed the mandatory `SupabaseClient<Database>` dependency.
- **`/api/v1/projects/[id]/execute`**: Migrated project & job querying and updating to `@aiva/database`.
- **`/api/v1/jobs/stop` / `pause` / `resume`**: Implemented robust user authentication with clean local development fallback.
- **`/api/v1/projects` & `/api/v1/settings`**: Added explicit error logging and default fallback settings (`gemini`, `edge_tts`, `sdxl`, `pexels`).

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`apps/web/src/services/pipeline/PipelineExecutor.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineExecutor.ts) | Modified | Standardized pipeline execution and state persistence on `@aiva/database` |
| [`apps/web/src/services/pipeline/PipelineLogger.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineLogger.ts) | Modified | Replaced Supabase insert with direct PostgreSQL query |
| [`apps/web/src/services/pipeline/LifecycleService.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/LifecycleService.ts) | Modified | Replaced Supabase select with direct PostgreSQL query |
| [`apps/web/src/services/pipeline/PipelineContext.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineContext.ts) | Modified | Removed `SupabaseClient` type requirement |
| [`apps/web/src/app/api/v1/projects/[id]/execute/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/execute/route.ts) | Modified | Migrated resume/execute endpoint to direct PostgreSQL |
| [`apps/web/src/app/api/v1/projects/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts) | Modified | Improved user lookup error logging |
| [`apps/web/src/app/api/v1/settings/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/route.ts) | Modified | Added default setting fallbacks for fresh databases |
| [`apps/web/src/app/api/v1/jobs/stop/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/stop/route.ts) | Modified | Fixed auth fallback for local development |
| [`apps/web/src/app/api/v1/jobs/pause/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/pause/route.ts) | Modified | Fixed auth fallback for local development |
| [`apps/web/src/app/api/v1/jobs/resume/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/jobs/resume/route.ts) | Modified | Fixed auth fallback for local development |
| [`.scratch/v1-working-cut/issues/01-unify-database-layer-and-pipeline-executor.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/01-unify-database-layer-and-pipeline-executor.md) | Modified | Marked Ticket 01 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **TypeScript Typecheck (`apps/web`)**:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```
   *Result:* Exit 0, 0 type errors.

2. **TypeScript Typecheck (`apps/template-renderer`)**:
   ```bash
   pnpm --filter aiva-template-renderer exec tsc --noEmit
   ```
   *Result:* Exit 0, 0 type errors.

3. **Python Worker Unit & Integration Tests**:
   ```bash
   venv\Scripts\python -m pytest tests/
   ```
   *Result:* 5/5 tests passed (1.53s).

---

## Manual QA Instructions

To manually verify Milestone 1:

1. **Start PostgreSQL & Redis**:
   ```powershell
   docker compose -f infra/docker-compose.yml up -d postgres redis
   ```
2. **Apply Database Migrations & Seeds**:
   ```powershell
   pnpm db:migrate
   ```
3. **Start Web Application**:
   ```powershell
   pnpm --filter web dev
   ```
4. **Submit a Test Project via PowerShell (Invoke-RestMethod) or Browser**:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/projects `
     -ContentType "application/json" `
     -Body '{"topic": "The History of Aviation", "style": "documentary"}'
   ```
5. **Verify Database State**:
   Inspect that the returned `job.id` exists in `public.jobs` and `public.projects` in local PostgreSQL without any Supabase connection errors in the terminal console.

### Expected Results
- Project and job are created and returned with HTTP 201.
- `PipelineExecutor` logs show standard PostgreSQL query execution instead of Supabase client errors.
