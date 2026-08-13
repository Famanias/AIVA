# 03 Wire Brief Parameters and Custom Script Bypass

Type: task
Status: open
Blocked by: 01

## Question

How should `PipelineExecutor` and the stage handlers branch to bypass `research` and `outline` when `input_mode === 'custom_script'`, and inject `voice_id`, `aspect_ratio`, `duration_target_seconds`, and `persona` into `PipelineContext.generationProfile` so every stage handler consumes them?

## Context

`page.tsx` collects `voice_id`, `persona`, `aspect_ratio`, `duration_target_seconds`, and `custom_script`, saving them to `state_payload`. However, `VoiceoverHandler.ts` hardcodes `voice_id: 'en-US-AriaNeural'`, `custom_script` is ignored, and research always runs on the topic slug regardless of input mode.

## Acceptance Criteria

1. If `input_mode === 'custom_script'`, pipeline enqueues and starts directly at `script_direction` (skipping `research` and `outline`).
2. The `ScriptDirectorAgent` receives the raw custom script and generates scene breakdowns respecting the script text.
3. `VoiceoverHandler` reads `state.generationProfile.voice_id` (or `state.voice_id`).
4. `CompositionHandler` and `RenderHandler` read `state.generationProfile.aspect_ratio` and geometry parameters.
