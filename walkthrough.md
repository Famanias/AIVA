# Walkthrough — Milestone 6: True Single-Scene Timeline Re-render

## Summary of Changes

Milestone 6 resolves **Ticket 06** by implementing true selective single-scene re-rendering:
- **Targeted Scene Audio & Visual Synthesis**: Updated [`rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py) to re-synthesize TTS narration and extract word timings for only the targeted scene that was edited on the timeline.
- **Database & Checkpoint Synchronization**: Updates `public.scenes` with the newly generated `voiceover_url`, `duration`, `voiceover_word_timings`, and sets `render_status = 'rendered'`. Syncs `checkpoint_03_script.json` and `checkpoint_04_voice.json`.
- **Master Composition Re-Stitching**: Stitches the newly synthesized scene audio with unchanged cached scene clips and background music into a fresh master video and `.srt` file using `CompositionEngine.run`.
- **Timeline Integration**: Verified with [`/api/v1/projects/[id]/scenes/[scene_id]/rerender`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/%5Bid%5D/scenes/%5Bscene_id%5D/rerender/route.ts) and the Timeline Studio frontend.

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`apps/workers/app/pipeline/rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py) | Modified | Implemented targeted single-scene TTS re-synthesis and composition re-stitching |
| [`apps/workers/tests/test_rerender_scene.py`](file:///d:/repos/AIVA/apps/workers/tests/test_rerender_scene.py) | New | Unit tests for single-scene partial re-rendering flow |
| [`.scratch/v1-working-cut/issues/06-implement-true-single-scene-rerender.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/06-implement-true-single-scene-rerender.md) | Modified | Marked Ticket 06 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **Python Worker Unit Tests**:
   ```bash
   venv\Scripts\python -m pytest tests/
   ```
   *Result:* Exit 0 — 10/10 passed (including `test_rerender_single_scene_flow`).

2. **TypeScript Typecheck (`apps/web`)**:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```
   *Result:* Exit 0 — 0 type errors.

3. **Re-render API Execution**:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/projects/257da8b6-a5a1-4372-bfc2-0d2eeb3226dc/scenes/a56e650a-8576-4708-8d9a-2fa5abcc19e6/rerender `
     -ContentType "application/json" `
     -Body '{"script_segment": "In December 1903, the Wright Brothers successfully sustained powered flight.", "visual_prompt": "historic biplane flying over Kitty Hawk dunes"}'
   ```
   *Result:* Exit 0 — `public.scene_versions` updated text and prompt, `public.scenes` set `render_status: 'queued'`.

---

## Manual QA Instructions

To manually verify Milestone 6:

1. **Run the Rerender Unit Test**:
   ```powershell
   cd d:\repos\AIVA\apps\workers
   venv\Scripts\python -m pytest tests/test_rerender_scene.py -v
   ```
2. **Trigger Scene Edit & Re-render via Timeline UI**:
   - Open `http://localhost:3000/projects/257da8b6-a5a1-4372-bfc2-0d2eeb3226dc/timeline` in your browser.
   - Click **Edit** on Scene #1.
   - Change the script or visual prompt text and click **Save & Re-render**.
3. **Verify API Scene State**:
   ```powershell
   (Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/v1/projects/257da8b6-a5a1-4372-bfc2-0d2eeb3226dc).data.scenes
   ```

### Expected Results
- Test `test_rerender_single_scene_flow` passes with code 0.
- Timeline Studio successfully saves edited script/prompt and initiates partial scene re-render.
