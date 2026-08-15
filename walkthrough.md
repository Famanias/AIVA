# Walkthrough: V1 Code Review Findings Remediation (F1 — F11)

We have cross-examined all findings from `code-review-findings-2026-08-15.md`, identified real root causes vs invalid claims, implemented all approved changes, and verified end-to-end functionality.

---

## 1. Cross-Examination Summary

| Finding | Review Assertion | Cross-Examination Result | Action Taken |
|---|---|---|---|
| **F1 / F10 / J5** | Factory LLM breaks on empty API key & has dead sync wrappers | **Verified Real**. Default config has `api_key: ""`, causing `OpenAICompatibleProvider` to error on fresh clones. Sync wrappers were unused. | Implemented auto-fallback to `OllamaProvider(base_url="http://localhost:11434", model="llama3.2")` when `api_key` is empty with warning logs. Removed dead sync wrappers. |
| **F2** | Fire-and-forget rerender route returns 200 even on worker 500/timeout | **Verified Real**. `fetch(...)` was not awaited; response always returned status 200. | Added `await` to `fetch()`, checked `res.ok`, and returned HTTP 502 with worker failure payload on errors. |
| **F3 / J4** | Suffix range requests fail (`bytes=-500`); stream helper duplicated | **Verified Real**. `parseInt("", 10)` produced `NaN` on suffix ranges (`bytes=-500`). Stream helper was duplicated. | Refactored with regex range parser supporting prefix, suffix, and open-ended ranges; deduplicated `nodeStreamToReadable`. |
| **F4 / F9** | Storage path resolution fragile under varying CWDs | **Verified Real**. Relative `../../storage` assumed a specific process CWD. | Implemented `get_storage_root() -> str` in `app/core/storage.py` and updated `checkpoint.py`. |
| **F5** | Composition engine uses raw `print()` statements | **Verified Real**. `engine.py`, `encoder.py`, `subtitle_generator.py` bypassed `structlog`. | Replaced all `print()` statements with structured `structlog` logging. |
| **F6** | Incomplete audio concatenation logic | **Verified Real**. Raw concat demuxer didn't handle path escaping consistently across stages. | Created `apps/workers/app/core/audio_utils.py` (`concat_audio_files`) with single-quote escaping (`'\''`) and tempfile cleanup. |
| **F7** | Per-scene parallel template rendering missing in pipeline | **Verified Real**. RenderHandler previously dispatched full IR to render engine. | Updated `RenderHandler.ts` to dispatch single-scene `PipelineIR` in parallel via `Promise.all` and persist individual `render_url` per scene in PostgreSQL. |
| **F8** | Visual overlay not re-rendered during single scene edit | **Verified Real**. `rerender_single_scene` updated TTS only and did not invoke `template-renderer`. | Added visual scene re-rendering via `TEMPLATE_RENDERER_URL/render` and updated `public.scenes.render_url`. |
| **F11** | Duration mismatch between prompt target and UI profile | **Verified Real**. API sent `duration_target_seconds` while prompts queried `target_duration_seconds`, falling back to 60s. | Updated `prompts.py` and `stage_handlers.py` to check both `duration_target_seconds` and `target_duration_seconds`. |
| **Middleware** | Claimed `middleware.ts` was missing | **Investigated & Addressed**. Next.js 16 uses `src/proxy.ts` (`middleware-to-proxy`). Attempting both triggers a build error. Verified that `src/proxy.ts` is the canonical Next.js 16 proxy. | Retained `src/proxy.ts` as the single entrypoint for auth/proxy headers. |

---

## 2. Key Code Changes

### [apps/workers/app/providers/factory.py](file:///d:/repos/AIVA/apps/workers/app/providers/factory.py)
- Auto-fallback to local Ollama (`llama3.2`) when `api_key` is empty:
```python
if not api_key or not api_key.strip():
    logger.warning("Empty API key for openai_compatible provider; falling back to local Ollama", model="llama3.2")
    return OllamaProvider(base_url="http://localhost:11434", model="llama3.2")
```

### [apps/web/src/app/api/v1/storage/[...path]/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/[...path]/route.ts)
- RFC-7233 range streaming with suffix range support:
```typescript
const suffixMatch = rangeHeader.match(/bytes=-(\d+)$/)
const standardMatch = rangeHeader.match(/bytes=(\d+)-(\d*)$/)
if (suffixMatch) {
  const suffixLength = parseInt(suffixMatch[1], 10)
  start = Math.max(0, fileSize - suffixLength)
  end = fileSize - 1
} else if (standardMatch) {
  start = parseInt(standardMatch[1], 10)
  end = standardMatch[2] ? parseInt(standardMatch[2], 10) : fileSize - 1
}
```

### [apps/workers/app/core/audio_utils.py](file:///d:/repos/AIVA/apps/workers/app/core/audio_utils.py)
- Modular audio concatenation with FFmpeg concat demuxer path escaping:
```python
def concat_audio_files(input_files: List[str], output_path: str, temp_dir: Optional[str] = None) -> str:
    # Handles 1 file copy or multi-file ffmpeg concat demuxer with safe single-quote escaping
```

### [apps/workers/app/core/composition/engine.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/engine.py)
- Converted all `print()` calls to `structlog` structured logs with `job_id`, `stage`, and `progress_pct`.

### [apps/web/src/services/pipeline/handlers/RenderHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/RenderHandler.ts)
- Per-scene parallel render dispatch:
```typescript
const sceneRenderResults = await Promise.all(
  scenes.map(async (s: any, index: number) => {
    // build single-scene IR, post to template-renderer, and update public.scenes
  })
)
```

### [apps/workers/app/pipeline/rerender_scene.py](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py)
- Dynamic geometry extraction from `generationProfile`, TTS re-synthesis, visual re-render via `template-renderer`, database update, and composition re-stitching using `concat_audio_files()`.

---

## 3. Verification Results

### 1. Python Test Suite
Ran `venv\Scripts\python -m pytest tests/ -v`:
- **Result**: `33 passed in 18.01s` (0 failures, 0 errors).
- Tested: Factory fallback to Ollama, audio ducking filter graph, SRT generation, composition engine e2e, multi-scene concatenation, schema compatibility, and single-scene rerendering.

### 2. TypeScript Typecheck
Ran `pnpm --filter web exec tsc --noEmit`:
- **Result**: `Exit code 0` (0 type errors).

### 3. Full Monorepo Production Build
Ran `pnpm build`:
- **Result**: `4/4 packages successful` (`@aiva/shared-types`, `@aiva/prompt-library`, `aiva-template-renderer`, `web`).
- All 18 Next.js 16 pages and API routes compiled and statically/dynamically optimized.

### 4. End-to-End CLI Pipeline Verification
Ran `certifier_runner.py` for both `voiceover` and `composition` stages:
- **Voiceover**: Multi-scene TTS synthesis synthesized 2 scenes, generated word timings, and concatenated `master_voice.mp3` cleanly (`audio_concatenation_successful count=2`).
- **Composition**: Burned in `.ass` kinetic subtitles, mixed ambient track with sidechain compressor ducking, and rendered final master video `composition.mp4` + `subtitles.srt` in **484 ms** using NVENC hardware acceleration.

---

## 4. Manual QA Validation

To manually validate these changes in your local environment, you can perform the following steps:

1. **Verify Ollama Fallback (F1)**
   - Remove or empty the `OPENAI_API_KEY` (or equivalent) in your worker `.env` file.
   - Start the Python worker.
   - Trigger a script/prompt generation.
   - Observe the worker logs for the warning: `Empty API key for openai_compatible provider; falling back to local Ollama`.

2. **Verify Storage Range Requests (F3)**
   - Run the Next.js server (`pnpm dev`).
   - Use `curl` to request a suffix byte range from an existing storage asset:
     ```bash
     curl -i -H "Range: bytes=-500" http://localhost:3000/api/v1/storage/your-project-id/master_voice.mp3
     ```
   - Verify the response is `206 Partial Content` and contains exactly the last 500 bytes of the file.

3. **Verify Parallel Scene Rendering (F7)**
   - Submit a new video generation request with multiple scenes.
   - Observe the network requests or Next.js logs.
   - You should see multiple `PipelineIR` payloads dispatched simultaneously, rather than sequentially.

4. **Verify Single Scene Visual Rerender (F8)**
   - In the Next.js UI, navigate to an existing video project.
   - Edit the text/script of a single scene and click rerender for that scene.
   - Verify that the `template-renderer` is invoked for that specific scene and the visual overlay (text/avatar) updates in the UI preview.

5. **Verify Structured Logging (F5)**
   - While generating a video, observe the Python worker terminal output.
   - Verify that log statements from `engine.py`, `encoder.py`, and `subtitle_generator.py` are output as structured JSON/key-value lines (via `structlog`) containing `job_id`, `stage`, and `progress_pct` rather than plain text statements.

6. **Verify Settings Model Auto-Detection & Save Without Manual Entry**
   - Navigate to `http://localhost:3000/settings`.
   - On initial page load or when switching presets (OpenRouter, OmniRoute, Ollama /v1), verify that the model list is automatically populated and displayed in a selectable dropdown.
   - Click **Save Settings** without manually typing custom model names or IDs.
   - Verify that settings save successfully and display the green confirmation toast (`Settings saved and encrypted in database!`).
