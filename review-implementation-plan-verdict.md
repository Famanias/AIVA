# AIVA — Two-Axis Review Verdict: `implementation_plan.md` (Supabase → Local-First PostgreSQL)

- **Subject reviewed:** `implementation_plan.md` (Database Strategy & Migration Plan)
- **Fixed point:** `HEAD` `5165606`; plan diff is uncommitted working-tree changes (`git diff HEAD -- implementation_plan.md`, −138/+98)
- **Method:** Two-axis review validated against the actual codebase (not the plan in isolation)
- **Date:** 2026-08-14
- **Second opinion on:** a plan-only agent verdict ("~80–85% of the way, don't execute unchanged")

---

## Verdict

**Direction is right — but the plan's factual base does not survive contact with the codebase. Do not execute as-is.**

The other agent's bottom line is confirmed and strengthened by code evidence. Keeping PostgreSQL over SQLite matches the EDD's stated end-state, and the migration away from Supabase is correct. But the plan makes three claims the code contradicts, proposes two steps that would break the build, and misses four files that depend on Supabase — and it ships an undocumented auth regression plus a Rule 12 documentation omission.

---

## Standards

### Hard violations (documented standards)

1. **Rule 12 — documentation drift — `.agents/rules/rules.md` §12.** The plan deletes Supabase but lists **no** documentation updates, while Supabase remains authoritative in `SETUP.md` (§4 is entirely Supabase CLI), `README.md:9,28,39,66,71`, `.env.example:8-13`, `walkthrough.md`, `HOW_TO_OBTAIN_API_KEYS.md`, `ARCHITECTURE.md`, and `ADR.md` (ADR 001/004 still "active"). The EDD is *already* self-contradictory — §11 declares "Zero cloud Supabase dependencies" yet §10:229, §12:325, §14:560, §39:1080, §42:1116, §43:1126 still mandate Supabase Auth/Storage. The plan would widen this drift.
2. **SECURITY.md §3 + Rule 14 / Rule 1 — auth removed with no replacement.** Deleting `apps/web/lib/supabase/middleware.ts` and the client/server singletons removes the only JWT-validating boundary; the plan proposes **no replacement auth mechanism**. EDD §14 and SECURITY.md §3 define auth as Supabase Auth. Removing it with no successor leaves API routes with no tenant/session check ("fail securely" is unaddressed). This is a redesign of a documented subsystem — Rule 1 requires proposing the change, not silently dropping it.

### Judgement calls (baseline smells / standards)

- **Rule 5/3 — provider abstraction.** "Replace Supabase Realtime channel listeners with lightweight REST polling / SSE" (`implementation_plan.md:82`) bakes a transport into `OperationsDashboardProvider.tsx` with no defined event/telemetry contract — violating "depend on abstractions" and contradicting the EDD's specified WebSocket fan-out (§10.1, §16.2). Polling is arguably simpler (Rule 11), but it must sit behind an interface with a stated rationale.
- **Rule 8 — zero hardcoding.** `DATABASE_URL` default `postgresql://postgres:postgres@localhost:5432/aiva` (plan L95) hardcodes credentials with no dev-only/production-override or least-privilege caveat — acceptable as a dev default, flagged as a judgement call.
- **Rule 2 / scope — "production-ready" overclaim.** Plan L58 calls the proposed compose "production-ready"; "local/self-hosted deployment-ready" is accurate for a V1.
- **No sequencing / rollback / risk section.** Deleting `supabase/` and the three SDK singletons is destructive and irreversible with zero audit step (schema FKs to `auth.users`, RLS, functions/types are never inventoried first).
- **Duplicate compose.** A root `docker-compose.yml` is proposed as NEW while `infra/docker-compose.yml` already runs postgres+redis+web+workers — two compose files invites drift (Rule 11/3).

### Confirmed good (plan strengths)

- Keeping PostgreSQL over SQLite — exactly matches EDD §11 and CONTEXT's completed pivot; no rewrite, no new deps (Rules 11/13).
- One `packages/database/migrations/` + idempotent `_migrations` runner = a single authoritative migration system, if Supabase tooling is genuinely dropped.
- Centralizing `DATABASE_URL` in `@aiva/database` honors Rule 8.
- Verification reuses existing suites (`db:migrate`, golden pipeline, pytest, tsc/build) consistent with repo test culture.

---

## Spec

**Bottom line: the plan does not accurately describe the codebase it proposes to change.** Three claims are false or overstated, two steps would break the build, and four Supabase-dependent files are never mentioned.

### (a) False / overstated claims

1. **"The codebase is already ~95% running on direct PostgreSQL"** (plan L13). Overstated. `@supabase/ssr` still powers the frontend: `OperationsDashboardProvider.tsx:31-45` does its **initial data load** via `supabase.from('projects').select('*, jobs(*)')` (not just realtime), and `DashboardProvider.tsx:44-89` holds **4 realtime channels** (jobs, job_events, pipeline_logs, projects). The plan only names `OperationsDashboardProvider`.
2. **L82 — "REST polling / SSE from `/api/v1/projects` and `/api/v1/jobs`".** Those endpoints don't exist. `apps/web/src/app/api/v1/projects/route.ts:6` only implements `POST`; there is **no `api/v1/jobs/route.ts`** (only `pause|resume|stop/`). The polling replacement target is fiction, and the plan never adds the GET routes.
3. **L87 — "Remove any leftover `@supabase/supabase-js` imports"** from the jobs routes. The routes import `@supabase/ssr` (`stop/route.ts:2`), and use it for `supabase.auth.getUser()` — the plan removes the SDK that also performs the auth check.
4. **L133 — "11/11 tests pass with asyncpg communicating with local PostgreSQL".** The count is coincidentally right, but the tests are mostly pure logic (AES/SRT/mixer-graph/IR-mapping), not asyncpg-DB tests, and there are 4 test files, not 3 as implied.

### (b) Already done (plan unaware)

- `_migrations` tracking table + idempotent skip + `DROP SCHEMA public CASCADE` reset: `packages/database/src/migrate.ts:37-64`
- `migrate.ts:66` already reads `packages/database/supabase/migrations` (8 files) + `seed.sql` (`:98`)
- `db:migrate` / `test:pipeline` scripts already in root `package.json:12-13`
- Compose already exists at `infra/docker-compose.yml:25-59` (postgres + redis:7-alpine + healthchecks + volumes)

### (c) Wrong / risky steps

1. **Repointing `migrate.ts` to `packages/database/migrations/` breaks the runner.** That directory is a **non-existent new dir**; the 8 real migration files + `seed.sql` live in `packages/database/supabase/migrations/`. Repointing without physically moving them breaks `migrate.ts:66-69` ("Migrations directory not found").
2. **Deleting root `supabase/` is safe** (only 7 files there, no `app_settings`) — but the plan's stated count ("All 8 migration files", L114) is only right because of the package dir it never mentions.
3. **Root compose duplicates `infra/docker-compose.yml`** and silently swaps `pgvector/pgvector:pg16` → `postgres:16-alpine`, **dropping pgvector** — a silent capability regression.

### (d) Missing file references (breakage on uninstall)

- `apps/web/src/providers/DashboardProvider.tsx:4,35-38,44-89` — `createBrowserClient` + **4** realtime channels.
- `apps/web/src/app/login/page.tsx:5,14-16,24-25` — auth via `supabase.auth.signInWithPassword/signUp`; **no replacement proposed**.
- `apps/web/src/app/api/v1/jobs/{stop,resume,pause}/route.ts:2,9-42` — `createServerClient` + `auth.getUser()`.
- `apps/web/src/components/dashboard/SystemHealthPanel.tsx:51` + `types/telemetry.ts:14` — reference supabase health status.
- (`apps/web/src/proxy.ts` is correctly NOT a supabase dependency — deleting `lib/supabase/middleware.ts` is fine on that axis.)

---

## Summary

**Standards:** 2 hard violations (Rule 12 docs drift; SECURITY §3 auth regression) + 5 judgement calls — worst: the plan removes the only auth boundary with no successor.
**Spec:** 4 false/overstated claims + 3 wrong/risky steps + 4 unmentioned files — worst: the polling/SSE replacement targets non-existent GET endpoints and the migration-dir repoint breaks the runner.

## Required fixes before execution

1. **Add the GET routes** `/api/v1/projects` and `/api/v1/jobs` (read + list) that the polling replacement claims to consume.
2. **Keep migrations where they are** — or move the 8 files + `seed.sql` to `packages/database/migrations/` *and* update `migrate.ts` in the same step; do not repoint to an empty directory.
3. **Reconcile compose**: extend `infra/docker-compose.yml` (preserving `pgvector/pgvector:pg16`) rather than adding a second root compose.
4. **Decide the auth replacement** before deleting the SDK (local-first session token, cookie-signed user stub, etc.) — and restore the project-creation auth check.
5. **Add a docs component** (SETUP.md, README, `.env.example`, ADR 001/004, walkthrough) and resolve the EDD's internal Supabase contradiction.
6. **Add acceptance gates**: `rg -ri "supabase" .` → zero *runtime* dependencies; fresh-clone clean-install test; SSE/polling path test.
7. **Name all supabase consumers** in the plan: `DashboardProvider`, `login/page.tsx`, jobs routes, `SystemHealthPanel`, `telemetry.ts`.