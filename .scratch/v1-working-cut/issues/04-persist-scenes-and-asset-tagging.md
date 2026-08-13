# 04 Persist Scenes and Asset Tagging to PostgreSQL

Type: task
Status: resolved
Blocked by: 01, 03

## Question

How should `ScriptHandler` and the Python script worker persist generated scene breakdowns to `public.scenes` and `public.scene_versions` with their tagged asset type (`stock_photo`, `ai_image`, `character_animation`), script segment, and visual prompt for immediate timeline consumption?

## Context

Scenes are currently stored only inside `state_payload` JSON. The database tables `public.scenes` and `public.scene_versions` remain completely empty during real runs, causing the Timeline Studio (`/projects/[id]/timeline`) and re-render endpoints to fail or see no data.

## Acceptance Criteria

1. Generated scene breakdowns are inserted into `public.scenes` and `public.scene_versions` with valid UUIDs, `project_id`, `sequence_number`, `duration`, `visual_type`, `script_segment`, and `visual_prompt`.
2. Each scene is explicitly tagged as `stock_photo`, `ai_image`, or `character_animation`.
3. Timeline Studio displays real scenes fetched from `public.scenes`.

## Answer

Resolved:
- `ScriptHandler.ts` now maps and persists all generated scene directions to `public.scenes` and `public.scene_versions` in PostgreSQL with proper UUID keys and normalized visual type enums.
- `VoiceoverHandler.ts`, `SubtitleHandler.ts`, and `RenderHandler.ts` update `voiceover_url`, `voiceover_word_timings`, `duration`, and `render_status` on `public.scenes` throughout the pipeline lifecycle.
- `GET /api/v1/projects/[id]` joins `public.scenes` with `public.scene_versions` to feed Timeline Studio with real persistent data.

