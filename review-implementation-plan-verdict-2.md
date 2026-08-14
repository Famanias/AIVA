# AIVA — Follow-up Two-Axis Review Verdict: `implementation_plan.md` (Revised)

- **Subject reviewed:** `implementation_plan.md` (revised — "Database Strategy & Migration Plan: Supabase to Local-First PostgreSQL (Revised)")
- **Prior verdict:** `review-implementation-plan-verdict.md` (2 hard standards violations, 4 false claims, 3 wrong/risky steps, 4 unmentioned files)
- **Method:** Re-validated each of the 7 required fixes from the prior verdict against the actual codebase
- **Date:** 2026-08-14

---

## Verdict

**The revised plan addresses every required fix from the prior verdict. It is now an accurate, executable plan — ready to run with three small additions.**

The revision is a genuine response, not cosmetic: it reconciles compose instead of duplicating it, names all seven supabase consumers, specifies the three missing GET endpoints it will depend on, introduces a real auth successor before deleting the SDK, moves migrations *and* updates the runner in one step, and adds a docs component plus a zero-runtime-supabase acceptance gate. Verified below line-by-line against the code.

---

## Standards

### Resolved (was hard violation)

1. **Rule 12 (docs drift) — RESOLVED.** New Component 6 ("Documentation & Architecture Alignment") adds `docs/adr/005-local-first-postgresql-migration.md`, modifies `ADR.md`, `README.md`, `SETUP.md`, `.env.example`, and reconciles `docs/EDD.md` §10, §12, §14, §39, §42, §43 — exactly the contradictory sections flagged in the prior verdict (EDD lines 229, 325, 560, 1080, 1116, 1126).
2. **SECURITY §3 / Rule 1 (auth regression) — RESOLVED.** New Component 3 introduces `apps/web/src/lib/auth/session.ts` (`getAuthenticatedUser`, HMAC-SHA256 tokens signed with `APP_SECRET`), a `POST /api/v1/auth/login` route, `login/page.tsx` rework to `fetch('/api/v1/auth/login')`, and `src/proxy.ts` header injection — a real successor before the `@supabase/ssr` boundary is removed.

### Remaining judgement calls

- **`isLocalDev` detection not planned.** `projects/route.ts:34` and `execute/route.ts:37` use `!process.env.NEXT_PUBLIC_SUPABASE_URL` as the local-dev signal. After `.env.example` drops that var, `isLocalDev` is *always* true. Harmless in single-user local mode, but the plan should switch these to a positive flag (e.g. `AIVA_AUTH_MODE=local`) — otherwise "local" becomes an accidental default.
- **Docs list is still incomplete.** Component 6 covers SETUP/README/.env.example/EDD/ADR but omits `walkthrough.md`, `HOW_TO_OBTAIN_API_KEYS.md` (entirely Supabase-keyed, lines 9–94), `ARCHITECTURE.md` (lines 12, 31, 36), `.github/workflows/ci.yml` (uses `supabase/setup-cli@v1` at lines 79–80), `MEMORY.md` (AD-010 Supabase MCP), and the `.gitignore` `supabase/` entries. Rule 12 says docs must not drift — these are still stale after this plan.
- **`db_dump.sql` not addressed.** Root `db_dump.sql:41,548` contains `supabase_vault` extension and `supabase_realtime` publication — a leftover dump that contradicts "zero Supabase"; plan should delete or flag it.

---

## Spec

### Resolved (was false/overstated/wrong)

1. **~95% direct-PG claim — now honestly scoped.** Component 5 names all seven consumers verified in the code: `OperationsDashboardProvider` (REST + 2 channels), `DashboardProvider` (4 channels), `SystemHealthPanel`, `telemetry.ts:14`, and the three jobs routes. The plan no longer claims the frontend is Supabase-free.
2. **Missing GET endpoints — now specified.** Component 4 adds `GET /api/v1/projects` (join projects+jobs), `GET /api/v1/jobs`, `GET /api/v1/jobs/[id]/events` — the exact endpoints that did not exist in the prior verdict. Polling now has a real target.
3. **`@supabase/ssr` vs `supabase-js` — now correct.** Component 5 removes `createServerClient`/`createBrowserClient` (`@supabase/ssr`) rather than the wrong package, and Component 5 deletes both from `package.json`.
4. **Migration repoint — now atomic.** Component 2 moves the 8 verified files + `seed.sql` to `packages/database/migrations/` and `packages/database/seed.sql`, and updates `migrate.ts:54-55` in the same step. Verified: the 8 files (incl. `20260812000000_app_settings.sql`) and `seed.sql` exist at the source; `packages/database/migrations/` does not yet exist (will be created by the move). The count "8" is now attributable to the correct directory.
5. **Compose duplication — now reconciled.** Component 1 extends `infra/docker-compose.yml` and **retains `pgvector/pgvector:pg16`** + `redis:7-alpine` — no root compose, no silent pgvector drop. Verified `infra/docker-compose.yml:26` uses `pgvector/pgvector:pg16`.
6. **Auth-consumer inventory — now complete.** login/page, both providers, jobs routes, health panel, telemetry all listed.

### Residual issues

- **"11/11 tests pass with asyncpg communicating with local PostgreSQL" (L144) still overstates.** Verified: 11 test functions exist but spread across **4 files** (3 listed + `tests/integration/test_schema_compatibility.py`); most are pure-logic tests (AES, SRT, mixer-graph), not asyncpg-DB tests. The count is right; the "asyncpg communicating with PostgreSQL" phrasing is not.
- **Zero-Supabase gate is narrower than advertised.** L146 `git grep -i "@supabase" apps/` catches the package imports but **not** `NEXT_PUBLIC_SUPABASE_*` string references (`stop/route.ts:10-11`, `server.ts:8-9`, providers) or the `isLocalDev` checks. Fine as a first gate, but the real acceptance gate is "zero runtime supabase imports **and** zero `NEXT_PUBLIC_SUPABASE` references in `apps/web`".
- **No fresh-clone clean-install test.** The prior verdict's fix #6 asked for it; the verification table adds "Frontend Live UI Check" but not a scripted clean-install (drop volume → compose up → migrate → create project → full pipeline → restart → verify persistence).

---

## Summary

**Standards:** 2 hard violations RESOLVED; 3 minor judgement calls remain (docs list, `isLocalDev` signal, `db_dump.sql`).
**Spec:** all 5 false claims / wrong steps corrected; 3 residual nits (test-count phrasing, gate coverage, no clean-install gate).

## Recommended before execution (all small)

1. Add `walkthrough.md`, `HOW_TO_OBTAIN_API_KEYS.md`, `ARCHITECTURE.md`, `.github/workflows/ci.yml`, `MEMORY.md`, `.gitignore` to Component 6; delete or flag `db_dump.sql`.
2. Replace the `!NEXT_PUBLIC_SUPABASE_URL` local-dev signal with a positive `AIVA_AUTH_MODE` flag.
3. Widen the acceptance gate to also assert zero `NEXT_PUBLIC_SUPABASE` references in `apps/`, and add a scripted clean-install test.

With those three additions the plan is executable as written.