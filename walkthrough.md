# Walkthrough — Milestone 4: Persist Scenes & Asset Tagging

## Summary of Changes

Milestone 4 resolves **Ticket 04** by establishing database persistence for scenes and asset tagging:
- **`ScriptHandler.ts`**: Maps all generated scene directions from the AI Script Director and inserts them directly into `public.scenes` and `public.scene_versions` in PostgreSQL with generated UUIDs and normalized visual types (`character_animation`, `broll`, `ai_image`, `kinetic_typography`). Updates `current_version_id` foreign keys.
- **`VoiceoverHandler.ts` & `SubtitleHandler.ts`**: Update `public.scenes` with generated `voiceover_url`, `duration`, and `voiceover_word_timings` for each scene.
- **`RenderHandler.ts`**: Updates `public.scenes` with `render_url` and marks `render_status = 'rendered'`.
- **`apps/web/src/app/api/v1/projects/[id]/route.ts`**: Returns project details joined with `public.scenes` and `public.scene_versions`, supplying the Timeline Studio (`/projects/[id]/timeline`) with live scene breakdown data.
- **Automated Integration Test**: Added `packages/database/src/test-scenes-persistence.ts` (`pnpm --filter @aiva/database test:scenes`).

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`apps/web/src/services/pipeline/handlers/ScriptHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/ScriptHandler.ts) | Modified | Inserted generated scenes and scene versions into PostgreSQL |
| [`apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts) | Modified | Updated scene voiceover URLs and durations in database |
| [`apps/web/src/services/pipeline/handlers/SubtitleHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/SubtitleHandler.ts) | Modified | Updated scene word timings in database |
| [`apps/web/src/services/pipeline/handlers/RenderHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/RenderHandler.ts) | Modified | Updated scene render status and URLs in database |
| [`apps/web/src/app/api/v1/projects/[id]/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/route.ts) | Modified | Joined scene versions for timeline API responses |
| [`packages/database/src/test-scenes-persistence.ts`](file:///d:/repos/AIVA/packages/database/src/test-scenes-persistence.ts) | New | Integration test for scene and version insertion & join querying |
| [`packages/database/package.json`](file:///d:/repos/AIVA/packages/database/package.json) | Modified | Added `test:scenes` npm script |
| [`.scratch/v1-working-cut/issues/04-persist-scenes-and-asset-tagging.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/04-persist-scenes-and-asset-tagging.md) | Modified | Marked Ticket 04 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **Scene Persistence Integration Test**:
   ```bash
   pnpm --filter @aiva/database test:scenes
   ```
   *Result:* Exit 0 — Scene and Version inserted and queried successfully via PostgreSQL.

2. **TypeScript Typecheck (`apps/web`)**:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```
   *Result:* Exit 0 — 0 type errors.

3. **Python Worker Unit Tests**:
   ```bash
   venv\Scripts\python -m pytest tests/
   ```
   *Result:* 5/5 passed.

---

## Manual QA Instructions

To manually verify Milestone 4:

1. **Run the Database Scene Persistence Test**:
   ```powershell
   pnpm --filter @aiva/database test:scenes
   ```
2. **Fetch Project & Scenes via API**:
   ```powershell
   $res = Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/v1/projects/257da8b6-a5a1-4372-bfc2-0d2eeb3226dc
   $res.data.scenes
   ```
3. **Verify in Browser**:
   Navigate to `http://localhost:3000/projects/257da8b6-a5a1-4372-bfc2-0d2eeb3226dc/timeline` in your browser and verify the scene card displays the script text, visual prompt, and visual type tag (`character_animation`).

### Expected Results
- API returns `status: success` with `scenes` containing `script_segment`, `visual_type`, `visual_prompt`, and `sequence_number`.
- Timeline Studio renders the scene cards.
