# Walkthrough — Working Version 1 Release Execution

This document details the step-by-step implementation, files modified, automated verification results, and manual QA instructions for each phase of the working V1 release plan.

---

## Phase 1: Secret & Database Infrastructure Harmonization

### What Was Implemented
1. **Master Secret Harmonization (`apps/workers/app/core/db.py` & `packages/database/src/crypto.ts`)**:
   - Standardized default master fallback secret across TypeScript (`crypto.ts`) and Python (`db.py`) to `aiva_default_local_master_secret_2026`.
   - Fixed silent error swallowing in `crypto.ts` by adding explicit error logging when decryption fails.

2. **Docker Compose & Environment Secret Propagation (`infra/docker-compose.yml` & `.env.example`)**:
   - Explicitly injected `APP_SECRET` (`aiva_default_local_master_secret_2026`) and `DATABASE_URL` (`postgresql://postgres:postgres@postgres:5432/aiva`) into container environment definitions for `workers`, `template-renderer`, and `web`.
   - Updated `.env.example` to document `APP_SECRET` and `DATABASE_URL`.

3. **Decoupled QueueControlService from Cloud Supabase (`apps/web/src/services/queue.control.service.ts`)**:
   - Replaced cloud `supabase-js` SDK client initialization (`createClient(...)`) with direct PostgreSQL queries via `@aiva/database` `query()`.
   - Enables local job cancellation, pausing, and resuming without requiring cloud Supabase instances.

---

### Files & Components Changed
- `[MODIFY]` [`apps/workers/app/core/db.py`](file:///d:/repos/AIVA/apps/workers/app/core/db.py) — Harmonized fallback master secret string.
- `[MODIFY]` [`packages/database/src/crypto.ts`](file:///d:/repos/AIVA/packages/database/src/crypto.ts) — Added explicit error logging for secret decryption failures.
- `[MODIFY]` [`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml) — Injected `APP_SECRET` and `DATABASE_URL` across all container services.
- `[MODIFY]` [`.env.example`](file:///d:/repos/AIVA/.env.example) — Documented `APP_SECRET` and `DATABASE_URL`.
- `[MODIFY]` [`apps/web/src/services/queue.control.service.ts`](file:///d:/repos/AIVA/apps/web/src/services/queue.control.service.ts) — Migrated from cloud `supabase-js` to `@aiva/database` `query()` client.

---

### Automated Verification Performed

1. **Database & Crypto Unit Tests**:
   ```bash
   pnpm --filter @aiva/database test
   ```
   **Result:** ✅ PASSED (AES-256-GCM encryption & decryption roundtrip verified with matching fallback key).

2. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

3. **Python Worker Unit Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 0.28s).

---

### Manual QA Instructions

To manually verify Phase 1 on your machine, follow these steps:

#### Step 1: Start Container Infrastructure
Run:
```powershell
docker-compose -f infra/docker-compose.yml up postgres redis -d
```

#### Step 2: Verify Master Secret Resolution in Python
Run Python one-liner to verify master secret lookup:
```powershell
$env:PYTHONPATH="apps/workers"; .\apps\workers\venv\Scripts\python.exe -c "from app.core.db import decrypt_secret; print('Python decrypt ready')"
```
**Expected Output:** Prints `Python decrypt ready` with no encryption key mismatch warnings.

#### Step 3: Run Database Unit Tests
```powershell
pnpm --filter @aiva/database test
```
**Expected Output:** Output confirms `✓ Crypto roundtrip test passed!`.
