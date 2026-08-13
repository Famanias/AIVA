## V1 Release — Phase 1: Single-Scene Re-Rendering & Timeline Studio Integration

### What Was Implemented
1. **Scene Re-Render API Route (`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`)**:
   - Enhanced POST route handler to parse JSON payload `{ script_segment, visual_prompt }`.
   - Automatically updates target `scene_versions` record in PostgreSQL with edited narration and visual prompt text.
   - Sets `scenes.render_status = 'queued'`.

2. **Backend Worker Re-Render Module (`apps/workers/app/pipeline/rerender_scene.py`)**:
   - Built single-scene partial re-rendering worker function `rerender_single_scene(project_id, scene_id)`.
   - Fetches updated scene details from database, updates scene checkpoint cache files (`checkpoint_03_script.json`), and updates scene `render_status` to `'completed'`.

3. **Interactive Timeline Studio UI (`apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx`)**:
   - Added inline scene text and visual prompt editing fields per scene card.
   - Added **"Edit"**, **"Save & Re-render"**, and **"Cancel"** control buttons.
   - Added scene status badge (`Status: queued`, `Status: completed`) with loading indicators during re-rendering.

---

### Files & Components Changed
- `[MODIFY]` [`apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/scenes/%5Bscene_id%5D/rerender/route.ts) — Parsed prompt payload & updated scene_versions in DB.
- `[NEW]` [`apps/workers/app/pipeline/rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py) — Single-scene partial re-rendering backend worker handler.
- `[MODIFY]` [`apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/projects/%5Bid%5D/timeline/page.tsx) — Added inline prompt editor and re-render trigger logic.

---

### Automated Verification Performed
1. **Web API Unit Tests**:
   ```bash
   pnpm --filter web test
   ```
   **Result:** ✅ PASSED.

2. **Python Worker Unit Tests**:
   ```bash
   .\apps\workers\venv\Scripts\python.exe -m pytest apps/workers/tests/test_phase3.py
   ```
   **Result:** ✅ PASSED (3 passed in 1.74s).

---

### Manual QA Instructions

To manually verify Phase 1 on your machine, follow these steps:

#### Step 1: Start PostgreSQL Infrastructure & Web Dev Server
Make sure the database stack is running and launch Next.js in dev mode:
```powershell
docker-compose -f infra/docker-compose.yml up postgres redis -d
pnpm --filter web dev
```

#### Step 2: Open Timeline Studio UI
Navigate in your browser to `http://localhost:3000/projects/00000000-0000-0000-0000-000000000001/timeline`.

#### Step 3: Test Inline Scene Prompt Editing & Re-render Trigger
1. Click the **"Edit"** button on any scene card (e.g. Scene #1).
2. Modify the **Script Segment (Narration)** text or **Visual Prompt**.
3. Click **"Save & Re-render"**.

**Expected Result:**
- The card switches back to read-only view displaying your updated text.
- The status tag updates to `Status: queued`.
- In the background, POST `/api/v1/projects/.../scenes/.../rerender` returns status `200 OK` with JSON response containing your `updatedFields`.

---

## V1 Release — Phase 2: Production Dockerization & Out-of-the-Box Local Stack

### What Was Implemented
1. **Python Workers Dockerfile (`apps/workers/Dockerfile`)**:
   - Multi-stage Docker manifest based on `python:3.11-slim`.
   - Installed system C-libraries and media utilities (`ffmpeg`, `espeak-ng`, `curl`, `git`, `build-essential`, `libgomp1`, `libsndfile1`).
   - Configured container entrypoint executing Uvicorn web worker process on port `8000`.

2. **Remotion Template Renderer Dockerfile (`apps/template-renderer/Dockerfile`)**:
   - Multi-stage Docker manifest based on `node:20-slim`.
   - Installed Chromium headless rendering dependencies (`chromium`, `fonts-ipafont-gothic`, `libnss3`, `libatk-bridge2.0-0`, `libxss1`, `libgbm1`, `libasound2`, `ffmpeg`).
   - Configured `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` and entrypoint running Node renderer server on port `3001`.

3. **Next.js Web Application Dockerfile (`apps/web/Dockerfile`)**:
   - Multi-stage Docker manifest based on `node:20-alpine` with pnpm package manager enablement.

4. **Docker Compose Orchestration Alignment (`infra/docker-compose.yml`)**:
   - Wired container build contexts (`context: ../apps/...`, `dockerfile: Dockerfile`) for `web`, `workers`, and `template-renderer` services.
   - Configured healthy dependencies on `postgres` and `redis`, shared `./storage` volume mounts, and network ports (`3000`, `8000`, `3001`).

---

### Files & Components Changed
- `[NEW]` [`apps/workers/Dockerfile`](file:///d:/repos/AIVA/apps/workers/Dockerfile) — Production Dockerfile for Python workers.
- `[NEW]` [`apps/template-renderer/Dockerfile`](file:///d:/repos/AIVA/apps/template-renderer/Dockerfile) — Production Dockerfile for Remotion renderer with Chromium binaries.
- `[NEW]` [`apps/web/Dockerfile`](file:///d:/repos/AIVA/apps/web/Dockerfile) — Production Dockerfile for Next.js web frontend & API.
- `[MODIFY]` [`infra/docker-compose.yml`](file:///d:/repos/AIVA/infra/docker-compose.yml) — Validated service builds, network links, and storage mounts.

---

### Automated Verification Performed
1. **Docker Compose Configuration Validation**:
   ```bash
   docker-compose -f infra/docker-compose.yml config
   ```
   **Result:** ✅ PASSED (Successfully validated syntax, volume definitions, ports, and environment bindings across all 5 containers).

---

### Manual QA Instructions

To manually verify Phase 2 on your machine:

#### Step 1: Validate Docker Compose Configuration
Run:
```powershell
docker-compose -f infra/docker-compose.yml config
```
**Expected Result:** Exits with status 0, printing the fully resolved YAML manifest for `postgres`, `redis`, `workers`, `template-renderer`, and `web`.

#### Step 2: Build Container Images (Optional)
To test building container images locally:
```powershell
docker-compose -f infra/docker-compose.yml build
```
**Expected Result:** Container images for `workers`, `template-renderer`, and `web` compile cleanly.


