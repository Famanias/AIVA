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

