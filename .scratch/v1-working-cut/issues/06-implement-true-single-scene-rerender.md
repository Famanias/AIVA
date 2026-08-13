# 06 Implement True Single-Scene Re-render

Type: task
Status: open
Blocked by: 05

## Question

How do we implement end-to-end single-scene re-rendering in `rerender_scene.py` and the timeline API, regenerating only the modified scene's audio/visuals, updating checkpoints, and re-stitching the master MP4 with cached unchanged scene clips?

## Context

`rerender_single_scene` in `rerender_scene.py` currently only updates `checkpoint_03_script.json` and executes `UPDATE public.scenes SET render_status = 'completed'` without regenerating any audio, visual assets, or re-running FFmpeg composite.

## Acceptance Criteria

1. Timeline edit endpoint updates `public.scenes` and `public.scene_versions` for the targeted scene.
2. Worker regenerates the targeted scene's voiceover (TTS) and visual media (Remotion overlay/image).
3. Checkpoints (`03_script`, `04_voice`, `06_assets`) are updated with the new scene assets.
4. FFmpeg composition is dispatched, stitching unchanged cached scene clips with the newly rendered scene clip into a fresh master MP4.
