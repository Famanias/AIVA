# 05 Implement Parallel Scene Synthesis, Captions and Ducked Audio

Type: task
Status: open
Blocked by: 04

## Question

How do we implement parallel scene asset generation (concurrent TTS, stock asset download, SDXL image generation, and Remotion scene clip render via `asyncio.gather` / `Promise.all`), extract word-level subtitle timings, and bundle background music with FFmpeg `sidechaincompress` audio ducking?

## Context

`PipelineExecutor` runs 9 stages sequentially with zero scene parallelism. `CompositionHandler.ts` sends `music_track: null` so background music and audio ducking never engage. `subtitle_extraction` returns empty word timings and `SubtitleHandler` stores under `voice.subtitles` while `CompositionHandler` reads `voice.wordTimings`, producing stubbed `[No subtitles]` captions.

## Acceptance Criteria

1. Per-scene asset synthesis (TTS generation, stock/image fetching, Remotion clip rendering) runs concurrently using `asyncio.gather` or `Promise.all`.
2. Real word timings from TTS/Whisper are passed cleanly to `CompositionHandler` and exported as valid `.srt` files and burned captions.
3. Bundled background music is fed into FFmpeg composition with `sidechaincompress` auto-ducking against the voiceover track.
