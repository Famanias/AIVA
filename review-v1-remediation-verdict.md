# AIVA — Follow-up Two-Axis Code Review: Remediation Verdict

- **Branch reviewed:** `pivot-to-selfhosting-localfirst`
- **Fixed point:** `09fba3c` (previous review's HEAD, same branch)
- **Diff:** `git diff 09fba3c...HEAD` — 8 commits, 31 files, +1093 / −619
- **Date:** 2026-08-13
- **Prior review:** `review-v1-verdict.md` (verdict: NOT a working Version 1)

Commits under review:

```
2e754b4 docs(v1): Add Phase 6 (Container Build) section to walkthrough
2488e37 fix(v1): Phase 6 - Repair template-renderer image build
262b9c5 fix(v1): Phase 6 - Container Build & Dockerfile Repair
dc9432e fix(v1): Phase 6 - Container Build & Dockerfile Repair
c74a4f3 fix(v1): Phase 5 - Scene Re-rendering Infrastructure & Queue Listener Wiring
51a3570 fix(v1): Phase 4 - Composition Output Persistence & Subtitle Export
530bbc7 fix(v1): Phase 2 - Real Provider Wiring & In-App Settings Integration
374f4c2 fix(v1): Phase 1 - Secret & DB Infrastructure Harmonization
```

---

## Verdict

**Still not a working Version 1.**

The remediation fixed two of the prior blockers (secret harmonization, MP4/subtitle persistence, brief-form fields, route collision, docker builds) but left the critical path broken: the web route writes jobs to local PostgreSQL while the pipeline executor still reads from Supabase, so a fresh clone's submission never reaches the worker. Step 3 (no parallelism, no ducking, stubbed captions) and Step 5 (fake re-render that only flips a status flag) are still unimplemented, and the new async provider wiring introduced an auth regression plus a dead duplicate line.

---

## Standards

### Hard violations (documented standards)

1. **Auth removed from project creation — `apps/web/src/app/api/v1/projects/route.ts`**
   The route previously returned 401 unless `supabase.auth.getUser()` succeeded. It now picks `SELECT id FROM auth.users LIMIT 1` or falls back to zero-UUID and creates projects with no auth check. Violates AGENTS.md Security ("Never trust client input") and EDD §14 (auth-based tenant isolation). The `catch {}` around the user lookup also violates AGENTS.md Error Handling ("Never silently ignore errors"). Regression, not remediation.
2. **Dead duplicate line — `apps/workers/app/pipelines/stage_handlers.py:165-166`**
   ```
   agent = VoiceoverAgent(tts)
   agent = VoiceoverAgent(tts)
   ```
   Duplicated Code / dead statement introduced by this diff; the claim that providers were "wired" is undermined by a leftover line.
3. **`print()` instead of structured logging — `apps/workers/app/core/composition/engine.py`**
   `print(f"[CompositionEngine] Persisted final video to {target_mp4}")` and `subtitle_generator.py` use `print`/`logger.error` inconsistently. AGENTS.md Logging: "Prefer structured logging." Engine also uses fragile cwd-relative `../../storage` path guessing instead of the configured storage root.

### Judgement calls (baseline smells)

- **Duplicated provider selection — `factory.py`**: sync `get_llm_provider` (lru_cache) vs `get_llm_provider_async` duplicate the same if-cascade with divergent cases (sync ignores "openai"; async gemini fallback omits `model`). Repeated Switches / Duplicated Code.
- **Duplicated SQL + N+1 — `queue.control.service.ts`**: `stopAll`/`pauseAll` are near-identical (same SQL assembly, same loop); each `stopJob`/`pauseJob` runs 2 queries per job sequentially. Injection-safe (params use `$1`; `filter` is branched, never interpolated) — correct.
- **Silent dispatch failure — `rerender/route.ts`**: fire-and-forget `fetch(...).catch(console.warn)` returns `success` even when the worker never receives the job; `revision: 1` hardcoded. Violates Error Handling spirit ("return meaningful messages").
- **Unreported feature removal — `apps/web/src/app/projects/[id]/page.tsx`**: 119-line operator dashboard deleted with no replacement; only a `timeline` page survives. If intentional, walkthrough.md must document it (it claims to).
- **Vestigial config — `.env.example`**: `DATABASE_ENCRYPTION_KEY` remains but crypto now uses `APP_SECRET`; dead/confusing.

### Confirmed correct

- Fallback secret `aiva_default_local_master_secret_2026` now matches across `db.py`, `crypto.ts`, `.env.example`, compose (all three services get `APP_SECRET`+`DATABASE_URL`).
- `crypto.ts` no longer swallows: warns on plaintext fallback, rethrows on decrypt failure.
- `test-ollama` URL validation (protocol allowlist + `.origin`) fixes the SSRF/format issue.
- `rerender_scene.py` UUID validation returns `not_found` instead of raising.

---

## Spec

**Bottom line: Still NOT a working Version 1.** Steps 1 and 4 are substantially fixed; Step 2 works only if the user configures a live provider; Steps 3 (parallel + ducked music) and 5 (true scene re-render) remain unimplemented; and a new orchestration split blocks the whole run.

### (a) Missing / partial requirements

1. **Step 1 partial.** Spec: *"Pick format, length, persona, and voice."* `page.tsx` collects all four and `projects/route.ts:59` saves them into `state_payload` — but nothing consumes them. `VoiceoverHandler.ts:23` hardcodes `voice_id: 'en-US-AriaNeural'`; persona is never read; aspect_ratio is read from `generation_profile` (never set by the route). Voice/length/persona picks are dead.
2. **Step 2 partial.** Providers are now live (`stage_handlers.py` awaits async getters), but default `llm_provider=gemini` with empty key fails on a fresh clone; `custom_script` is ignored (research always runs on the topic slug). Scenes are stored in `state_payload` only — nothing writes `public.scenes`, so the timeline/rerender have no scenes for real runs.
3. **Step 3 missing.** Spec: *"Visuals, voiceover, timed captions, and ducked music — all rendered in parallel."* `PipelineExecutor.ts` runs 9 stages strictly sequentially; no `asyncio.gather` anywhere. `CompositionHandler.ts:75` still sends `music_track: null` → sidechaincompress never engages. `subtitle_extraction` still returns `word_timings: []`, and the handler stores subtitles under `voice.subtitles` while `CompositionHandler` reads `voice.wordTimings` → SRT is the "[No subtitles]" stub.
4. **Step 5 still fake.** Spec: *"Tweak any scene … and only that scene re-renders."* `rerender_scene.py` is now reachable via the wired `/pipeline/rerender_scene` router, but still only rewrites `checkpoint_03_script.json` and flips `render_status` — no image/TTS/FFmpeg regeneration, no re-assembly.

### (b) Scope creep

Full `queue.control.service.ts` rewrite (stop/pause/resume/bulk, 340 lines) is not in the 4-step spec.

### (c) Implemented but wrong

1. **Critical orchestration split:** `projects/route.ts` inserts job+project into **local PG**, but `PipelineExecutor.ts:19-20` (the BullMQ worker on the critical path) fetches/persists via **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). On a fresh clone the executor throws "Failed to fetch job" — the job was written where the executor never looks. Same for the auth-guarded `jobs/*` routes. Supabase remains in the critical path.
2. `@aiva/shared-types` ships `main: ./dist/index.js` with `dist/` gitignored and no prepare script → `pnpm --filter web build` on a true fresh clone fails to resolve it (contradicts walkthrough's "build passed").

---

## Summary

**Standards:** 3 hard violations + 5 judgement calls — worst: auth removed from project creation.
**Spec:** 4 missing/partial + 1 scope-creep + 2 wrong — worst: the local-PG-write / Supabase-read split that blocks the whole run.
