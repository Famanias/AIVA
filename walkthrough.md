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

---

## Phase 2: Frontend & API Layer (`apps/web`)

### What Was Implemented
1. **Local Self-Hosted Single-User Proxy (`apps/web/proxy.ts`)**:
   - Injected default local user & workspace session headers (`x-user-id`, `x-workspace-id`) into all requests, bypassing cloud Supabase auth in local mode.

2. **Static Media Streaming API (`apps/web/src/app/api/v1/storage/[...path]/route.ts`)**:
   - Built media streaming route serving assets from `./storage/projects/...` with HTTP range request support (`206 Partial Content`) for video and audio playback.
   - Enforced path traversal security checks preventing access outside `./storage`.

3. **In-App Provider & Key Settings API (`apps/web/src/app/api/v1/settings/route.ts`)**:
   - GET/POST endpoint handlers reading and persisting encrypted API credentials and provider settings in the local PostgreSQL `app_settings` table via `@aiva/database`.

4. **Local Ollama Connectivity Test Endpoint (`apps/web/src/app/api/v1/settings/test-ollama/route.ts`)**:
   - Endpoint testing local Ollama connection (`http://localhost:11434/api/tags`) and returning installed model tags.

5. **Settings Management UI Page (`apps/web/src/app/(dashboard)/settings/page.tsx`)**:
   - Responsive Settings UI allowing users to select stage providers (LLM, TTS, Image, B-Roll), enter AES-256 encrypted cloud API keys, and perform live connection tests against local Ollama models.

6. **Timeline Studio UI Page (`apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx`)**:
   - Interactive scene timeline view with script segment preview, visual type tags, duration badges, and scene re-render controls.

7. **Single-Scene Partial Re-Render Endpoint (`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`)**:
   - Endpoint marking targeted scene render status as `queued` for partial single-scene re-rendering.

---

### Files & Components Changed
- `[MODIFY]` [`apps/web/proxy.ts`](file:///d:/repos/AIVA/apps/web/proxy.ts) — Updated Next.js 16 proxy for local single-user session injection.
- `[NEW]` [`apps/web/src/app/api/v1/storage/[...path]/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/%5B...path%5D/route.ts) — Local storage media streaming API route with range request support.
- `[NEW]` [`apps/web/src/app/api/v1/settings/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/route.ts) — Encrypted settings GET/POST API route.
- `[NEW]` [`apps/web/src/app/api/v1/settings/test-ollama/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/settings/test-ollama/route.ts) — Ollama connectivity check endpoint.
- `[NEW]` [`apps/web/src/app/(dashboard)/settings/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/settings/page.tsx) — System & Provider Settings UI page.
- `[NEW]` [`apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/projects/%5Bid%5D/timeline/page.tsx) — Timeline Studio page.
- `[NEW]` [`apps/web/src/app/api/v1/projects/[id]/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/route.ts) — Project details & scene fetching endpoint.
- `[NEW]` [`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/scenes/%5Bscene_id%5D/rerender/route.ts) — Single-scene re-render endpoint.
- `[NEW]` [`apps/web/src/test-phase2.ts`](file:///d:/repos/AIVA/apps/web/src/test-phase2.ts) — Phase 2 automated unit test suite.
- `[MODIFY]` [`apps/web/package.json`](file:///d:/repos/AIVA/apps/web/package.json) — Added `@aiva/database` workspace dependency and `test` script.
- `[MODIFY]` [`apps/web/tsconfig.json`](file:///d:/repos/AIVA/apps/web/tsconfig.json) — Added `@aiva/database` path mapping.

---

### Automated Verification Performed

1. **Ran Phase 2 API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Results:**
   - ✅ GET `/api/v1/settings` returned success status & settings payload.
   - ✅ POST `/api/v1/settings` updated local `app_settings` in PostgreSQL.
   - ✅ POST `/api/v1/settings/test-ollama` returned local model connectivity status.
   - ✅ Storage path traversal check blocked unauthorized file access (`403 Forbidden`).

2. **Ran Production Build & Type Check**:
   ```bash
   pnpm --filter web build
   ```
   **Results:**
   - ✅ Compiled Next.js web application with 0 errors. All API routes and dashboard pages generated cleanly.

---

### Manual QA Instructions

To manually verify Phase 2 on your machine, follow these exact steps:

#### Step 1: Start Database Stack & Run Web App in Dev Mode
Make sure your PostgreSQL container is running (`docker-compose -f infra/docker-compose.yml up postgres redis -d`), then start the Next.js web app:
```powershell
pnpm --filter web dev
```
Open your browser and navigate to `http://localhost:3000/settings`.

#### Step 2: Test & Save Settings Page Credentials
1. On `http://localhost:3000/settings`, select your active providers (e.g. LLM: Google Gemini, TTS: EdgeTTS).
2. Enter API keys into the Cloud API Keys section (e.g. `AIzaSy...`).
3. Click **Save Settings**.
4. Check the database to confirm values were saved and encrypted:
```powershell
docker exec -it aiva-postgres psql -U postgres -d aiva -c "SELECT key, value, is_encrypted FROM public.app_settings WHERE key = 'gemini_api_key';"
```
**Expected Result:** The `value` field is encrypted with AES-256 (format: `<iv>:<auth_tag>:<ciphertext>`) and `is_encrypted` is `true`.

#### Step 3: Test Ollama Local Model Connection
1. In the Local AI Models section of `http://localhost:3000/settings`, keep `http://localhost:11434`.
2. Click **Test Connection**.
**Expected Result:** If Ollama is running, a green alert appears displaying your installed Ollama models. If Ollama is not running, an informative warning badge informs you to start Ollama locally.

#### Step 4: Test Media Storage Range Streaming API
Create a test file inside `./storage`:
```powershell
New-Item -ItemType Directory -Force -Path "storage/projects/test-proj"
Set-Content -Path "storage/projects/test-proj/hello.json" -Value '{"message": "local storage stream working"}'
```
In your browser, visit `http://localhost:3000/api/v1/storage/projects/test-proj/hello.json`.
**Expected Result:** The JSON file contents are rendered with status `200 OK`.

#### Step 5: Test Single-Scene Re-render API
In PowerShell, trigger a scene re-render endpoint test:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/projects/00000000-0000-0000-0000-000000000000/scenes/00000000-0000-0000-0000-000000000001/rerender" -Method POST
```
**Expected Result:** Returns `{"status":"success","message":"Scene 00000000-0000-0000-0000-000000000001 queued for partial re-rendering", ...}`.

---

### Known Limitations or Issues
- Python worker pipeline execution will connect in **Phase 3** (Backend & Python Workers).
