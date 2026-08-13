# Implementation Plan — Final 8% to Version 1 MVP Release

This implementation plan details the final engineering phases required to transition AIVA from Phase 1 completion to a fully production-ready, 100% self-hosted Version 1 MVP.

---

## User Review Required

> [!IMPORTANT]
> **Key Scope & Architectural Decisions:**
> 1. **Single-Scene Re-Rendering Strategy (Phase 1):** Scene re-rendering will selectively generate voiceover, asset visual, and Remotion video clips for *only* the modified scene ID, then re-stitch the final video using FFmpeg by referencing unchanged cached scene artifacts from `./storage/projects/{id}/revisions/v{rev}/`. This avoids expensive full-video regenerations.
> 2. **Containerized Production Stack (Phase 2):** Production Dockerfiles will be added for `apps/workers` (Python 3.11 + FFmpeg + Whisper) and `apps/template-renderer` (Node.js 20 + Chromium dependencies), enabling `docker-compose up` to run out-of-the-box on fresh host machines without requiring local host Python/FFmpeg setups.
> 3. **Export & Storage Delivery (Phase 3):** Standardized file download headers (`Content-Disposition: attachment`) added to `/api/v1/storage/[...path]` for direct MP4, SRT subtitle, and project JSON downloads from the dashboard UI.

---

## Open Questions

> [!NOTE]
> None. All decisions align with `AGENTS.md`, `RULES.md`, and `docs/EDD.md`.

---

## Proposed Changes

### Phase 1: Single-Scene Re-Rendering & Timeline Studio Integration (~3%)

#### [MODIFY] [rerender/route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/projects/[id]/scenes/[scene_id]/rerender/route.ts)
- Implement POST route handler validating input JSON (`text`, `visual_prompt`, `voice_id`).
- Update target scene record in PostgreSQL (`scenes` table) with new prompt text.
- Enqueue a targeted `rerender_scene` job in BullMQ / Redis containing `project_id`, `scene_id`, and `revision`.

#### [NEW] [rerender_scene.py](file:///d:/repos/AIVA/apps/workers/app/pipeline/rerender_scene.py)
- Implement `rerender_single_scene` worker function:
  1. Generate new TTS voiceover file for the specific scene.
  2. Perform Whisper alignment for new scene audio.
  3. Fetch/generate new visual asset (B-roll/SDXL) for the scene.
  4. Render Remotion VP9 clip for the modified scene only.
  5. Invoke FFmpeg smart stitcher reusing cached unchanged scene clips, updating `composition.mp4` on disk.

#### [MODIFY] [page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx)
- Connect the **"Re-render Scene"** button to the rerender API endpoint.
- Add card-level loading states (`IsReRendering...`) and toast notifications.
- Dynamically refresh scene preview video and audio playback upon single-scene completion.

---

### Phase 2: Production Dockerization & Out-of-the-Box Local Stack (~3%)

#### [NEW] [Dockerfile](file:///d:/repos/AIVA/apps/workers/Dockerfile)
- Multi-stage Dockerfile for Python workers:
  - Base: `python:3.11-slim`.
  - Install system packages: `ffmpeg`, `espeak-ng`, `curl`, `git`.
  - Install Python virtualenv & dependencies from `requirements.txt`.
  - Configure container entrypoint running FastAPI worker process.

#### [NEW] [Dockerfile](file:///d:/repos/AIVA/apps/template-renderer/Dockerfile)
- Dockerfile for Node.js Remotion renderer:
  - Base: `node:20-slim`.
  - Install Chromium dependencies (`libnss3`, `libatk-bridge2.0-0`, `libxss1`, `libgbm1`, `fonts-ipafont-gothic`).
  - Install npm dependencies and build Remotion bundle.

#### [MODIFY] [docker-compose.yml](file:///d:/repos/AIVA/infra/docker-compose.yml)
- Configure `build` contexts for `web`, `workers`, and `template-renderer` services.
- Define shared `./storage` volume mounts across containers for direct media file exchange.
- Add healthcheck dependencies ensuring `postgres` and `redis` start before worker processes.

---

### Phase 3: Project Export, Download & Production Polish (~2%)

#### [MODIFY] [route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/storage/[...path]/route.ts)
- Add support for `?download=true` query parameter.
- Set `Content-Disposition: attachment; filename="..."` headers to trigger native browser file downloads.

#### [MODIFY] [page.tsx](file:///d:/repos/AIVA/apps/web/src/app/(dashboard)/projects/[id]/page.tsx)
- Add **"Download MP4"**, **"Download SRT Subtitles"**, and **"Export Project Checkpoint"** buttons to the project overview dashboard.
- Display detailed failure diagnostics and an interactive **"Resume Pipeline"** button when a job fails (backed by disk checkpoint recovery).

---

## Verification Plan

### Automated Tests
1. **Single-Scene Rerender Test:**
   ```bash
   pnpm --filter web test
   ```
   Verify POST `/api/v1/projects/[id]/scenes/[scene_id]/rerender` API route validation and execution payload.

2. **Docker Build Certification:**
   ```bash
   docker-compose build
   ```
   Verify all container images (`web`, `workers`, `template-renderer`) build cleanly without errors.

3. **End-to-End Golden Pipeline Test:**
   ```bash
   pnpm certify
   ```
   Run full system pipeline certification test in local mock mode.

### Manual Verification
1. Open `/projects/[id]/timeline` page, edit a scene's text prompt, click **"Re-render Scene"**, and verify only that specific scene is regenerated while updating the preview player.
2. Click **"Download MP4"** on the project page and verify browser downloads the final composition video file.
3. Run `docker-compose up` on a clean environment and verify the entire stack initializes successfully.
