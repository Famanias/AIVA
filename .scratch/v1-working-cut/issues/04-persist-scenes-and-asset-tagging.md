# 04 Persist Scenes and Asset Tagging to PostgreSQL

Type: task
Status: open
Blocked by: 01, 03

## Question

How should `ScriptHandler` and the Python script worker persist generated scene breakdowns to `public.scenes` and `public.scene_versions` with their tagged asset type (`stock_photo`, `ai_image`, `character_animation`), script segment, and visual prompt for immediate timeline consumption?

## Context

Scenes are currently stored only inside `state_payload` JSON. The database tables `public.scenes` and `public.scene_versions` remain completely empty during real runs, causing the Timeline Studio (`/projects/[id]/timeline`) and re-render endpoints to fail or see no data.

## Acceptance Criteria

1. Generated scene breakdowns are inserted into `public.scenes` and `public.scene_versions` with valid UUIDs, `project_id`, `sequence_number`, `duration`, `visual_type`, `script_segment`, and `visual_prompt`.
2. Each scene is explicitly tagged as `stock_photo`, `ai_image`, or `character_animation`.
3. Timeline Studio displays real scenes fetched from `public.scenes`.
