# Wayfinder Map: Working Version 1 (V1 Working Cut)

## Destination

A fully verified, fresh-clone operable Version 1 delivering all 4 core steps:
1. **Brief intake**: Topic or custom script, aspect ratio, duration, persona, and voice selection.
2. **AI story breakdown**: Script and scene-by-scene breakdown tagged for stock media, AI art, or animation, persisted to `public.scenes`.
3. **Parallel scene synthesis**: Visuals, voiceovers, timed captions, and ducked background music rendered concurrently.
4. **Master assembly & single-scene re-rendering**: Master MP4 + SRT assembly with selective single-scene timeline re-rendering.

## Notes

- **Domain**: AIVA AI Video Generation Platform (Short-Form Engine).
- **Architecture**: 100% self-hosted, local-first architecture (containerized PostgreSQL 16 + pgvector, Redis, Python FastAPI workers, Remotion template renderer, Next.js web).
- **Rules & Skills**: Respect `AGENTS.md`, `RULES.md`, and `SECURITY.md`. Use `domain-modeling`, `codebase-design`, `tdd`, and `code-review`.
- **Database Standard**: All database operations in Node.js must use `@aiva/database` (`pg.Pool`), eliminating `@supabase/supabase-js` from the execution path.

## Decisions so far

- [01 Unify Database Layer and Pipeline Executor](issues/01-unify-database-layer-and-pipeline-executor.md) — Eliminated `@supabase/supabase-js` from `PipelineExecutor`, `PipelineLogger`, and API routes, unifying state persistence and job orchestration on local PostgreSQL (`@aiva/database`).
- [02 Repair Monorepo Build and Shared Types Packaging](issues/02-repair-monorepo-build-and-shared-types.md) — Configured `prepare` script and Docker build steps for `@aiva/shared-types`, enabling clean clone builds without manual compilation.
- [03 Wire Brief Parameters and Custom Script Bypass](issues/03-wire-brief-parameters-and-custom-script-bypass.md) — Enabled custom script pipeline direct routing to `script_direction`, and propagated `generationProfile` (`aspect_ratio`, `voice_id`, `duration_target_seconds`, `persona`) through context and stage handlers.
- [04 Persist Scenes and Asset Tagging](issues/04-persist-scenes-and-asset-tagging.md) — Persisted generated scenes to `public.scenes` and `public.scene_versions` with normalized visual types and linked foreign keys for immediate Timeline Studio consumption.
- [05 Implement Parallel Scene Synthesis, Captions and Ducked Audio](issues/05-implement-parallel-scene-synthesis-and-ducked-audio.md) — Enabled concurrent per-scene TTS, preserved real word timings for SRT and burned captions, and wired FFmpeg `sidechaincompress` auto-ducking for background music.



## Not yet specified

- Advanced SFX track layering and dynamic transition audio
- Kinetic typography Remotion template family (Phase 2)
- Multi-user authentication & workspace RBAC (Phase 3)
- Distributed multi-worker GPU rendering fleet (Phase 3)

## Out of scope

- Long-form documentary multi-chapter generation (Phase 2+)
- Automated YouTube / TikTok social publishing and scheduling (Phase 2)
- Real-time in-browser canvas video editor (Phase 2)
