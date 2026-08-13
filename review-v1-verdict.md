# AIVA — Two-Axis Code Review: Working Version 1 Verdict

- **Branch reviewed:** `pivot-to-selfhosting-localfirst`
- **Fixed point:** `main` (merge-base `addd55b`, tip of `origin/main`)
- **Diff:** `git diff main...HEAD` — 9 commits, 52 files, +3492 / −645
- **Date:** 2026-08-13

Commits under review:

```
09fba3c docs: update CONTEXT.md reflecting 100% Version 1 MVP completion
34ba240 feat(v1): Phase 3 - project export, downloads & production polish
f788e90 feat(v1): Phase 2 - production dockerization & out-of-the-box local stack
44c402c feat(v1): Phase 1 - single-scene re-rendering & timeline studio integration
c7b217b docs: update EDD.md and CONTEXT.md with finalized Self-Hosted Local-First Architecture decisions
c56f653 feat(e2e): Phase 4 - complete self-hosted pivot integration & end-to-end verification
dcf1caa feat(workers): Phase 3 - asyncpg PostgreSQL pool, encrypted app_settings, stage checkpointing & Ollama provider
f3f657a feat(web): Phase 2 - local proxy session, storage streaming API, encrypted settings UI & timeline studio
bbc82a1 feat(infra): Phase 1 - Containerized Postgres, app_settings migration, direct pg client & AES-256 crypto
```

---

## Verdict

**Not a working Version 1.**

Both axes converge on the same conclusion from independent directions — the Standards axis shows the shipped code doesn't do what it claims (dead re-render path, mismatched encryption keys, silently swallowed failures), and the Spec axis shows none of the 4 steps is a fresh-clone-runnable end-to-end flow (broken downloads, serial rendering, no ducking, unreachable pages, P2 scope shipped as V1).

A working Version 1 was defined as: *"the user who clones this repository can perform the following steps in the frontend, and the backend will successfully produce a video."*

1. Type a topic or paste your own script. Pick format, length, persona, and voice — that's the whole brief.
2. AI drafts the story — Script plus a scene-by-scene breakdown, each scene tagged for real stock photo or AI art.
3. Scenes come alive — Visuals, voiceover, timed captions, and ducked music — all rendered in parallel.
4. Ship the cut — The final MP4 is assembled. Tweak any scene on the timeline and only that scene re-renders.

---

## Standards

### Hard violations (documented standards)

1. **Cross-service encryption key mismatch — AGENTS.md Security ("never expose secrets"); broken silently.** `packages/database/src/crypto.ts:10` falls back to `aiva_default_local_master_secret_2026`; `apps/workers/app/core/db.py:56` falls back to `aiva-default-development-secret-key-32bytes`. Neither `APP_SECRET` nor `DATABASE_URL` is set in `infra/docker-compose.yml` or the Dockerfiles. In a full-docker deploy, web encrypts under one key and workers decrypt under another → `db.py` returns `""`, and `factory.py:53` builds `GeminiProvider(api_key="")` with no log. Secrets fail silently end-to-end.
2. **Silent error swallowing — AGENTS.md Error Handling ("never silently ignore errors… log failures").** `local-db.ts:68-70` is an empty `catch`; `factory.py:51-53` falls back to Gemini with an empty key, no warning. `crypto.ts:41-43` treats any non-`iv:tag:ct` string as plaintext and passes it through — a corrupt/mis-encrypted value is silently accepted as a live secret.
3. **Setup docs drifted — SETUP.md §3 still documents `DATABASE_ENCRYPTION_KEY`; code reads `APP_SECRET`** (CONTEXT.md agrees). Standard: "never allow documentation to drift away from implementation."
4. **`rerender_scene.py` doesn't do what its name/docstring claims** ("re-renders scene audio/visual assets, re-stitches composition") — it only rewrites a checkpoint JSON and flips `render_status` to `completed`. Additionally nothing ever calls `rerender_single_scene`; the web route only sets `render_status='queued'` with no enqueue/consumer. Misleading behavior + claimed queue-based processing (EDD) that isn't wired.

### Judgement calls (baseline smells)

- **Duplicated Code**: `apps/web/proxy.ts` and `apps/web/src/middleware.ts` are byte-identical header-injection logic; `proxy.ts` is now dead but still copied in `Dockerfile:9`.
- **Duplicated Code**: storage route `route.ts:49-55` vs `71-77` (identical stream wrapper).
- **Unvalidated range input**: `route.ts:42-44` — `bytes=-500`/garbage yields `NaN`, `createReadStream` throws a 500; no 416, no `Accept-Ranges` on 200, no bound clamping (AGENTS.md "validate inputs").
- **SSRF**: `test-ollama/route.ts:11` fetches a client-supplied URL server-side, unvalidated.
- **Mysterious/misleading naming**: `factory.py:38-42` — `openai` provider returns `OpenRouterProvider` reading `openai_api_key`.
- **Divergent Change / middle men**: `factory.py` grows a second `_async` mirror of every provider getter.
- **Security hygiene**: hardcoded `postgres/postgres` in compose; fixed `x-user-id` header injection via middleware; `migrate.ts:52` `DROP SCHEMA public CASCADE`; unauthenticated storage GET — all acceptable in single-user local mode, but none is flagged in code.

---

## Spec

**Bottom line: NOT a working Version 1.** The 4-step flow is pre-existing and Supabase-bound; the diff adds UI/modules that look complete but are neither wired nor runnable on a fresh clone. Weakest/broken: **Step 4 (ship/download) and Step 5 (single-scene re-render)**.

### (a) Missing or partial requirements

1. **Step 1 — brief form partial.** Spec: "Type a topic or paste your own script. Pick format, length, persona, and voice." `apps/web/src/app/page.tsx` (unchanged from main) only has Topic + Template Style; no script paste, format, length, persona, or voice. The new pages are un-reachable: `app/(dashboard)/projects/[id]` conflicts with the existing `app/projects/[id]` (both resolve to `/projects/[id]`) — a Next.js duplicate-route build error.
2. **Step 3 — no parallel rendering.** README.md: "Scenes process sequentially in Phase 1. Parallel worker execution is slated for Phase 3." `voiceover_agent.py` loops `await` serially; RenderHandler sends one whole-timeline IR to Remotion. "Timed captions" is stubbed — `handle_subtitle_extraction_stage` returns `word_timings: []`.
3. **Step 3 — ducked music never engages.** Spec: "ducked music." `audio_mixer.py:38-41` builds `sidechaincompress`, but `CompositionHandler.ts:75` always sends `music_track: null` → ducking never runs in the pipeline.
4. **Step 4 — MP4 not downloadable.** Engine writes to `tempdir/aiva_composition_out/master_{job_id}.mp4` (`engine.py:44`); the download link expects `storage/projects/{id}/composition.mp4` (`page.tsx:96`). Nothing copies between them → 404.
5. **Step 5 — re-render not wired.** Spec: "Tweak any scene on the timeline and only that scene re-renders." `rerender/route.ts` only edits `scene_versions` + sets `render_status='queued'`; `rerender_single_scene` (`rerender_scene.py`) is never invoked by any router/worker/queue — dead code. No seed creates the `00000000-…000000000001` project the walkthrough's QA URL opens.

### (b) Scope creep

ROADMAP P2 explicitly owns "Interactive Timeline Studio UI… Partial scene re-render" and warns "Do not build P2 features during P1." The diff delivers Timeline Studio, re-render, settings UI, AES crypto, Ollama, dockerization — P2 items sold as V1 completion.

### (c) Implemented-but-wrong

- Settings UI writes `app_settings`, but the workers' `stage_handlers.py` uses env-bound sync factories; the new async `get_*_provider_async` are never called → provider/API-key selection has no effect.
- Dockerization broken: web Dockerfile has no `pnpm install`/`next build` before `pnpm start`; workers Dockerfile runs `uvicorn main:app` (module is `app.main:app`); `@aiva/database` is a `workspace:*` dep with no monorepo build.
- "E2E suite" (`test-phase4.ts`) only checks migrations/encryption/a row insert + a checkpoint file — it never generates a video.
- Cross-service key mismatch: TS default `APP_SECRET` vs Python fallback differ (`.env.example` even names `DATABASE_ENCRYPTION_KEY`).
- `.env.example`/README/SETUP still require Supabase; docker-compose provides no Supabase → fresh-clone create-project (`/api/v1/projects`, PipelineExecutor, queue control are all supabase-js) cannot run.

---

## Summary

**Standards:** 4 hard violations + ~7 judgement calls — worst: cross-service `APP_SECRET` mismatch that silently mangles credentials.
**Spec:** 5 missing/partial + 1 scope-creep + 5 wrong — worst: Step 4 — the final MP4 is never copied to the path the download link serves.