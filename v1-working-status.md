# AIVA — Working V1 Status Report

> Status assessment of what actually works right now, based on the two code reviews in
> `review-v1-verdict.md` and `review-v1-remediation-verdict.md` (branch `pivot-to-selfhosting-localfirst`, HEAD `2e754b4`).

---

## Overall Progress Toward a Working V1

**Roughly 55% of the way — and the missing 45% is the critical path.**

- Steps 1 and 4 are largely built in the UI and storage layer.
- Step 2 exists and runs, but only if the user configures a live AI provider with real API keys.
- Step 3 is the least complete: no parallel rendering, no ducked music, captions are stubbed.
- Step 4's re-render sub-feature is a status flip, not a real re-render.
- **The single hard blocker:** the web writes jobs to local PostgreSQL, but the pipeline executor still reads them from Supabase. On a fresh clone, submitting a project never reaches the worker. Nothing downstream runs until that split is closed.

---

## What's Working Right Now (Verified)

### Infrastructure & Secrets
- **Containerized PostgreSQL 16 + pgvector** runs via Docker Compose on port 5432 with healthchecks and persistent volumes.
- **Master secret harmonized** across services: `aiva_default_local_master_secret_2026` now matches in `crypto.ts`, `db.py`, `.env.example`, and is injected as `APP_SECRET` + `DATABASE_URL` into `workers`, `template-renderer`, and `web` in `docker-compose.yml`.
- **AES-256-GCM encryption** of `app_settings` credentials works; `crypto.ts` now logs decryption failures instead of silently swallowing them.
- **Direct DB drivers** in place: `pg.Pool` in Node, `asyncpg` in Python.

### Web / API
- **Brief creation form** (`/`) collects topic-or-pasted-script, format/aspect ratio, duration, template style, voice, and persona, and saves them into `jobs.state_payload`.
- **Route collision fixed**: legacy `apps/web/src/app/projects/[id]` removed; the dashboard route group resolves.
- **Storage streaming API** (`/api/v1/storage/[...path]`) serves local assets with HTTP range requests (206 Partial Content) and `?download=true` attachment headers, including `.srt` MIME mapping.
- **Settings UI** (`/settings`) with encrypted app-settings CRUD and an **Ollama test-connection** endpoint that now validates URL protocol/scheme (SSRF guard).
- **Queue control service** decoupled from Supabase — direct PostgreSQL queries for stop/pause/resume/bulk, injection-safe.

### Workers / Pipeline
- **Provider wiring is live**: stage handlers now `await` the async provider getters, which resolve decrypted credentials from `app_settings` (gemini / groq / openrouter / ollama).
- **Composition persistence fixed**: `engine.py` copies `master_{job_id}.mp4` to `storage/projects/{project_id}/composition.mp4` and writes `subtitles.srt`; the download route serves both.
- **Scene re-render endpoint wired**: `/pipeline/rerender_scene` worker route exists and is dispatched from the web rerender route via `WORKER_API_URL`; UUID validation returns `not_found` instead of raising.
- **Offline LLM**: `OllamaProvider` for 100% local inference.

### Docker
- **Workers image builds** (python:3.11-slim + FFmpeg + Whisper), **web image builds** (Next.js), and **template-renderer image builds** (pnpm + monorepo root context, chromium), with a 724 MB → 4.74 MB build context reduction.

---

## What's Partial (Built, But Not Fully Wired)

| Area | Status | Gap |
|---|---|---|
| Step 1 — Brief form | UI done, params saved to `state_payload` | **Nothing consumes them.** Voice is hardcoded (`en-US-AriaNeural`) in `VoiceoverHandler.ts`; persona never read; aspect ratio read from `generation_profile` which the route never sets. |
| Step 2 — AI draft | Pipeline + live providers exist | Default `llm_provider=gemini` with empty key fails on a fresh clone; `custom_script` ignored (research always runs on the topic slug); scenes only live in `state_payload`, never written to `public.scenes` → timeline/rerender see no scenes on real runs. |
| Step 4 — Downloads | Composition + SRT persisted and served | Nothing can be produced on a fresh clone due to the orchestration blocker, so there is nothing to download yet. |
| Docker | All three images build | Worker `CMD` fixed; `@aiva/shared-types` `dist/` is gitignored with no prepare script → `web build` fails on a true clean checkout. |

---

## What's Not Working / Blockers

1. **CRITICAL — Local-PG write / Supabase-read split.** `projects/route.ts` inserts the job into local PostgreSQL, but `PipelineExecutor.ts` (the BullMQ worker on the critical path) fetches/persists via Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). On a fresh clone: "Failed to fetch job" — the job is written where the executor never looks. Same for the auth-guarded `jobs/*` routes.
2. **Step 3 — no parallel rendering.** `PipelineExecutor.ts` runs the 9 stages strictly sequentially; no `asyncio.gather` anywhere. README confirms parallel execution is post-P1.
3. **Step 3 — ducked music never engages.** `CompositionHandler.ts` always sends `music_track: null`, so the `sidechaincompress` audio filter never runs.
4. **Step 3 — timed captions are stubbed.** Subtitle extraction returns `word_timings: []`; the handler stores subtitles under `voice.subtitles` while the composer reads `voice.wordTimings` → SRT is the "[No subtitles]" stub.
5. **Step 4 — re-render is a status flip, not a re-render.** `rerender_scene.py` only rewrites `checkpoint_03_script.json` and sets `render_status='completed'` — no image/TTS/FFmpeg regeneration, no re-assembly of the scene.
6. **Auth regression.** Project creation no longer authenticates the user (picks `SELECT id FROM auth.users LIMIT 1` or falls back to zero-UUID) — a security regression introduced by the pivot.
7. **Minor:** duplicate `agent = VoiceoverAgent(tts)` dead line in `stage_handlers.py:165-166`; `print()` instead of structured logging in the composition engine; `DATABASE_ENCRYPTION_KEY` still documented in `.env.example` though `APP_SECRET` is used.

---

## Step-by-Step Readiness

| V1 Step | Readiness | Notes |
|---|---|---|
| 1. Brief (topic/script, format, length, persona, voice) | ~80% | UI complete and persisted; selections not yet consumed by the pipeline. |
| 2. AI drafts story (script + scene breakdown, tagged stock/AI) | ~55% | Engine works with a configured live provider; script-paste ignored, scenes not persisted to `scenes` table. |
| 3. Scenes come alive (visuals, VO, captions, ducked music, parallel) | ~30% | Visuals + VO run sequentially; no parallelism, no ducking, captions stubbed. |
| 4. Ship the cut (MP4 assembled + single-scene re-render) | ~45% | MP4/SRT persisted and downloadable; re-render is fake; whole flow blocked by the PG/Supabase split. |

---

## What It Would Take to Call It a Working V1

1. **Close the orchestration split** — make `PipelineExecutor` (and the `jobs/*` routes) read/write local PostgreSQL like everything else. This unblocks the entire fresh-clone run.
2. **Wire Step 1 params into the pipeline** — consume `voice_id`, `persona`, `aspect_ratio`, `custom_script`, duration from `state_payload` (stop hardcoding in `VoiceoverHandler`/`generation_profile`).
3. **Persist scenes to `public.scenes`** so the timeline and re-render path have real data.
4. **Make re-render real** — regenerate the edited scene's TTS/visual assets and re-assemble the final composition, keeping other scenes' checkpoints.
5. **Step 3 (optional for a first usable cut):** parallel stage execution, real timed captions, and non-null music track for ducking.
6. **Fix the build-on-clean-clone issue** (`@aiva/shared-types` dist) and restore auth on project creation.
