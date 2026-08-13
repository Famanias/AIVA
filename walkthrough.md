# Walkthrough — Milestone 5: Parallel Scene Synthesis, Captions & Ducked Audio

## Summary of Changes

Milestone 5 resolves **Ticket 05** by implementing parallel scene synthesis, real word-level subtitle timings, and FFmpeg audio ducking (`sidechaincompress`):
- **Parallel TTS Synthesis**: Updated [`voiceover_agent.py`](file:///d:/repos/AIVA/apps/workers/app/agents/voiceover_agent.py) to synthesize all scene TTS audio concurrently using `asyncio.gather(*tasks)`.
- **Real Word Timings & Timed Captions**: Updated [`stage_handlers.py`](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py) (`handle_subtitle_extraction_stage`) to compute cumulative global word timings from TTS timestamps, and updated [`SubtitleHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/SubtitleHandler.ts) to forward them to pipeline state and the database.
- **Background Music & Audio Ducking**: Bundled `storage/audio/ambient_track.mp3` and updated [`CompositionHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts) to feed the background music track into FFmpeg composition. [`AudioMixer.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/audio_mixer.py) applies `sidechaincompress` to duck the music volume whenever speech is active.
- **Encoder & Path Robustness**: Added fallback in [`encoder.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/encoder.py) from NVENC to CPU `libx264` and resolved media paths in [`validator.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/validator.py).

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`apps/workers/app/agents/voiceover_agent.py`](file:///d:/repos/AIVA/apps/workers/app/agents/voiceover_agent.py) | Modified | Concurrently synthesize scene voiceovers via `asyncio.gather` |
| [`apps/workers/app/pipelines/stage_handlers.py`](file:///d:/repos/AIVA/apps/workers/app/pipelines/stage_handlers.py) | Modified | Extract real per-scene and global word timings |
| [`apps/web/src/services/pipeline/handlers/SubtitleHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/SubtitleHandler.ts) | Modified | Forward global word timings to pipeline state |
| [`apps/web/src/services/pipeline/handlers/CompositionHandler.ts`](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts) | Modified | Wire background music track and word timings for ducking |
| [`apps/workers/app/core/composition/graph_builder.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/graph_builder.py) | Modified | Subtitle filter path escaping for Windows |
| [`apps/workers/app/core/composition/validator.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/validator.py) | Modified | Robust media path resolution |
| [`apps/workers/app/core/composition/encoder.py`](file:///d:/repos/AIVA/apps/workers/app/core/composition/encoder.py) | Modified | Automatic libx264 fallback for NVENC |
| [`storage/audio/ambient_track.mp3`](file:///d:/repos/AIVA/storage/audio/ambient_track.mp3) | New | Bundled ambient background music loop |
| [`apps/workers/tests/test_composition_ducking.py`](file:///d:/repos/AIVA/apps/workers/tests/test_composition_ducking.py) | New | Automated tests for word timings, ducking filter, SRT, and e2e composition |
| [`.scratch/v1-working-cut/issues/05-implement-parallel-scene-synthesis-and-ducked-audio.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/05-implement-parallel-scene-synthesis-and-ducked-audio.md) | Modified | Marked Ticket 05 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **Python Worker Unit & E2E Composition Tests**:
   ```bash
   venv\Scripts\python -m pytest tests/
   ```
   *Result:* Exit 0 — 9/9 passed (including parallel word timings, audio ducking filter graph, and end-to-end media composition with ducking).

2. **Monorepo Build**:
   ```bash
   pnpm build
   ```
   *Result:* Exit 0 — 4/4 packages built successfully (shared-types, prompt-library, template-renderer, web).

3. **TypeScript Typecheck (`apps/web`)**:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```
   *Result:* Exit 0 — 0 type errors.

---

## Manual QA Instructions

To manually verify Milestone 5:

1. **Run the Worker Tests**:
   ```powershell
   cd d:\repos\AIVA\apps\workers
   venv\Scripts\python -m pytest tests/test_composition_ducking.py -v
   ```
2. **Verify Ducking Filter Graph Output**:
   Check the test logs for `test_audio_mixer_ducking_graph` and confirm `sidechaincompress=threshold=0.08:ratio=4:attack=50:release=300[music_ducked]` and `amix` are generated.
3. **Verify SRT Output**:
   Check `test_srt_generation` and verify timestamped subtitles (`00:00:00,000 --> ...`) are properly formatted.

### Expected Results
- All 4 tests in `test_composition_ducking.py` pass with code 0.
- End-to-end video with ducked music and subtitles encodes cleanly without errors.
