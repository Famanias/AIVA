# Walkthrough — AIVA Self-Hosted Local Pivot Execution

This document details the step-by-step phase execution, files modified, automated tests run, and manual QA instructions for verifying each phase.

---

## Phase 1: Infrastructure & Database Layer

### What Was Implemented
1. **Containerized PostgreSQL Service (`infra/docker-compose.yml`)**:
   - Added containerized `pgvector/pgvector:pg16` PostgreSQL database service running on port `5432` with healthcheck (`pg_isready`) and persistent volume (`postgres_data`).
   - Configured `workers`, `template-renderer`, and `web` containers to wait for healthy `postgres` and `redis` services.
   - Updated container volume mounts to map local storage directory (`./storage:/app/storage`).

2. **App Settings Database Migration (`packages/database/supabase/migrations/20260812000000_app_settings.sql`)**:
   - Created `app_settings` table schema to store provider API keys, local model URLs, and active provider selections.
   - Seeded default key-value records (`llm_provider`, `tts_provider`, `image_provider`, `broll_provider`, `ollama_base_url`, `ollama_model`).

3. **AES-256-GCM Encryption Utility (`packages/database/src/crypto.ts`)**:
   - Implemented `encryptSecret` and `decryptSecret` functions using Node.js `crypto` module.
   - Encrypts sensitive API keys using AES-256-GCM with a 32-byte key derived from `process.env.APP_SECRET`.

4. **Direct PostgreSQL Client & Settings Helper (`packages/database/src/local-db.ts`)**:
   - Built a lightweight `pg.Pool` connection wrapper replacing cloud Supabase dependencies.
   - Added `getAppSetting(key)` and `setAppSetting(key, value, isEncrypted)` helper functions with automatic AES-256 encryption/decryption.

5. **Idempotent Migration Runner Script (`packages/database/src/migrate.ts`)**:
   - Built standalone migration runner that executes all SQL migration files in `supabase/migrations/` in order, tracking executed migrations in `public._migrations` table to guarantee idempotency.
   - Initializes `auth` schema stub, helper functions (`auth.uid()`, `auth.role()`), and applies `seed.sql`.

6. **Automated Unit Tests (`packages/database/src/test-phase1.ts`)**:
   - Created test suite verifying AES-256 encryption roundtrips and connection string resolution.

---

### Files & Components Changed
- `[MODIFY]` [`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml) — Added containerized PostgreSQL service, environment variables, healthchecks, and volume mounts.
- `[NEW]` [`packages/database/supabase/migrations/20260812000000_app_settings.sql`](file:///d:/repos/AIVA/packages/database/supabase/migrations/20260812000000_app_settings.sql) — `app_settings` database schema and initial seed configuration.
- `[NEW]` [`packages/database/src/crypto.ts`](file:///d:/repos/AIVA/packages/database/src/crypto.ts) — AES-256-GCM encryption & decryption functions.
- `[NEW]` [`packages/database/src/local-db.ts`](file:///d:/repos/AIVA/packages/database/src/local-db.ts) — Direct PostgreSQL `pg.Pool` client and setting CRUD operations.
- `[NEW]` [`packages/database/src/migrate.ts`](file:///d:/repos/AIVA/packages/database/src/migrate.ts) — Idempotent migration runner script.
- `[NEW]` [`packages/database/src/index.ts`](file:///d:/repos/AIVA/packages/database/src/index.ts) — Main export barrel for `@aiva/database`.
- `[NEW]` [`packages/database/src/test-phase1.ts`](file:///d:/repos/AIVA/packages/database/src/test-phase1.ts) — Phase 1 automated unit test script.
- `[MODIFY]` [`packages/database/package.json`](file:///d:/repos/AIVA/packages/database/package.json) — Added `pg` dependencies, `test` script, and `migrate` script.
- `[MODIFY]` [`packages/database/supabase/seed.sql`](file:///d:/repos/AIVA/packages/database/supabase/seed.sql) — Added `ON CONFLICT DO NOTHING` for idempotent seed execution.
- `[MODIFY]` [`package.json`](file:///d:/repos/AIVA/package.json) — Added root `db:migrate` script.

---

### Automated Verification Performed
Ran Phase 1 database unit test suite:
```bash
pnpm --filter @aiva/database test
```
**Results:**
- ✅ AES-256-GCM Crypto Encryption & Decryption roundtrip verified.
- ✅ Connection string resolution verified (`postgresql://postgres:postgres@localhost:5432/aiva`).

Ran database migration runner:
```bash
pnpm db:migrate
```
**Results:**
- ✅ Auth stub & helper functions created cleanly.
- ✅ Applied `20260718000000_core_schema.sql`, `20260718115941_job_events.sql`, and `20260812000000_app_settings.sql`.
- ✅ Applied `seed.sql` system defaults.

---

### Manual QA Instructions

To manually verify Phase 1 on your machine, follow these exact steps:

#### Step 1: Start Docker Compose Infrastructure Stack
Open PowerShell / Terminal in `D:\repos\AIVA` and run:
```powershell
docker-compose -f infra/docker-compose.yml up postgres redis -d
```

#### Step 2: Verify PostgreSQL & Redis Container Health
Check that both `aiva-postgres` and `aiva-redis` containers are running and healthy:
```powershell
docker ps
```
**Expected Output:**
- `aiva-postgres` status shows `Up ... (healthy)` on port `0.0.0.0:5432->5432/tcp`.
- `aiva-redis` status shows `Up ... (healthy)` on port `0.0.0.0:6379->6379/tcp`.

#### Step 3: Run Database Migrations
Apply the database migrations using the workspace package name:
```powershell
pnpm db:migrate
```
*(Alternative package filter syntax: `pnpm --filter @aiva/database migrate`)*

**Expected Output:**
```
==========================================
    AIVA Database Migration Runner        
==========================================

1. Ensuring auth schema, helper functions, and default user stub exist...
✓ Auth stub & functions ready.

2. Found 3 migration files.
[APPLYING] 20260718000000_core_schema.sql...
✓ Successfully applied: 20260718000000_core_schema.sql
[APPLYING] 20260718115941_job_events.sql...
✓ Successfully applied: 20260718115941_job_events.sql
[APPLYING] 20260812000000_app_settings.sql...
✓ Successfully applied: 20260812000000_app_settings.sql

3. Executing seed script (seed.sql)...
✓ System default seed data applied.

✅ Database schema migrations & seed data applied successfully!
```

#### Step 4: Verify Database Tables & `app_settings` Seed Records
Inspect the database tables directly inside the container:
```powershell
docker exec -it aiva-postgres psql -U postgres -d aiva -c "\dt"
```
**Expected Output:**
Should list tables: `_migrations`, `animation_rigs`, `app_settings`, `cost_ledger_entries`, `job_events`, `jobs`, `projects`, `scene_versions`, `scenes`, `video_style_presets`, `workspaces`.

Check `app_settings` seed rows:
```powershell
docker exec -it aiva-postgres psql -U postgres -d aiva -c "SELECT key, value, is_encrypted, category FROM public.app_settings;"
```
**Expected Output:**
Lists seed keys: `llm_provider`, `tts_provider`, `image_provider`, `broll_provider`, `ollama_base_url`, `ollama_model`.

#### Step 5: Run Phase 1 Automated Unit Tests
```powershell
pnpm --filter @aiva/database test
```
**Expected Output:**
```
✓ Encrypted format test: <iv>:<auth_tag>:<cipher>
✓ Crypto roundtrip test passed!
✓ Connection string builder test passed!
✅ Phase 1 Database & Crypto Unit Tests Completed Successfully!
```

---

### Known Limitations or Issues
- Full UI settings management page is scheduled for **Phase 2** (Frontend & API Layer).
- Python worker direct `asyncpg` integration is scheduled for **Phase 3** (Backend & Python Workers).
