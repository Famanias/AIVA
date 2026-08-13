# Walkthrough — Milestone 3: Wire Brief Parameters & Custom Script Bypass

## Summary of Changes

Milestone 3 resolves **Ticket 03** by wiring brief parameters and supporting direct custom script bypass:
- **`apps/web/src/app/api/v1/projects/route.ts`**: When `input_mode === 'custom_script'` (or a custom script is provided), the job initializes with `current_step = 'script_direction'`, skipping the research and outline stages. Packages `generationProfile` (`aspect_ratio`, `duration_target_seconds`, `voice_id`, `persona`, `visual_style`) into `state_payload`.
- **`PipelineContext.ts` & `PipelineExecutor.ts`**: Extended `PipelineContext` with `GenerationProfile` and dynamically injected the profile into every stage handler.
- **`ScriptHandler.ts`**: Allows execution when `custom_script` is present without requiring an outline, and forwards `custom_script` and `generation_profile` to the Python worker.
- **`VoiceoverHandler.ts`**: Dynamically consumes `voice_id` from `context.generationProfile`.
- **`CompositionHandler.ts` & `RenderHandler.ts`**: Dynamically calculate frame dimensions (`width`, `height`) and aspect ratios from `context.generationProfile.aspect_ratio`.
- **Python Workers (`pipeline.py` & `stage_handlers.py`)**: Updated `ScriptDirectionStageRequest` and `handle_script_direction_stage` to parse and chunk user custom scripts into visual scenes.

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`apps/web/src/app/api/v1/projects/route.ts`](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/route.ts) | Modified | Routed custom scripts to `script_direction` and stored `generationProfile` |
| [`apps/web/src/services/pipeline/PipelineContext.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineContext.ts) | Modified | Added `GenerationProfile` definition to `PipelineContext` |
| [`apps/web/src/services/pipeline/PipelineExecutor.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/PipelineExecutor.ts) | Modified | Populated and injected `generationProfile` in handler context |
| [`apps/web/src/services/pipeline/handlers/ScriptHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/ScriptHandler.ts) | Modified | Handled custom script dispatching to Python worker |
| [`apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/VoiceoverHandler.ts) | Modified | Read `voice_id` dynamically from context |
| [`apps/web/src/services/pipeline/handlers/CompositionHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts) | Modified | Extracted `aspect_ratio` and frame dimensions from context |
| [`apps/web/src/services/pipeline/handlers/RenderHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/RenderHandler.ts) | Modified | Extracted `aspect_ratio` and canvas dimensions from context |
| [`apps/workers/app/routers/pipeline.py`](file:///d:/repos/AIVA/apps/workers/app/routers/pipeline.py) | Modified | Added `custom_script` to request model |
| [`apps/workers/app/pipelines/stage_handlers.py`](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py) | Modified | Handled custom script text chunking in script director stage |
| [`.scratch/v1-working-cut/issues/03-wire-brief-parameters-and-custom-script-bypass.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/03-wire-brief-parameters-and-custom-script-bypass.md) | Modified | Marked Ticket 03 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **TypeScript Typecheck (`apps/web`)**:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```
   *Result:* Exit 0 — 0 errors.

2. **Python Worker Unit Tests**:
   ```bash
   venv\Scripts\python -m pytest tests/
   ```
   *Result:* 5/5 tests passed (3.18s).

3. **Database State Verification for Custom Script**:
   - Submitting a project with `input_mode: "custom_script"` created a job with `current_step: "script_direction"` and `state_payload.generationProfile` set.

---

## Manual QA Instructions

To manually verify Milestone 3:

1. **Submit a Custom Script Video Brief**:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/projects `
     -ContentType "application/json" `
     -Body '{"input_mode": "custom_script", "custom_script": "In 1903, the Wright Brothers achieved powered flight.", "aspect_ratio": "16:9", "voice_id": "en-US-GuyNeural", "duration_target_seconds": 30, "persona": "Dramatic"}'
   ```
2. **Verify Database Initial Stage**:
   Inspect that the returned job has `current_step: 'script_direction'` (skipping `research` and `outline`) and `state_payload.generationProfile` contains the selected `voice_id`, `aspect_ratio`, and `persona`.

### Expected Results
- API returns HTTP 201 with project and job objects.
- Job `current_step` is `script_direction`.
- `state_payload.generationProfile.aspect_ratio` is `'16:9'` and `voice_id` is `'en-US-GuyNeural'`.
