# ENGINEERING DESIGN DOCUMENT (EDD)

**Project: AIVA — AI-Powered YouTube Automation Platform**

---

# 1. Executive Summary

AIVA is an enterprise-grade, highly modular, multi-tenant software-as-a-service (SaaS) platform designed to automate the end-to-end production of high-quality, long-form (20–30 minute) **YouTube automation-style videos**. Rather than locking every channel into one visual identity, AIVA lets a creator pick a **video output style** per channel or per project — stickman animation, documentary-style B-roll narration, kinetic typography explainers, or avatar narration — and mix per-scene overrides on top of that default.

The system is built around one insight the previous version under-emphasized: **the renderer is not "a stickman engine," it's a general programmatic template engine.** A stickman rig, a Ken-Burns photo pan with lower-third captions, and an animated typography callout are all just different Remotion component families rendered by the same worker, cached the same way, and composited by the same FFmpeg pipeline. Framing it this way is what makes adding new styles cheap instead of requiring a parallel system per style.

By orchestrating distributed workflows across a collection of low-cost and open-source models, the system reduces the manual production timeline from hours down to roughly **20–35 minutes** (see §46), targeting an operational cost of **\$0.60–\$1.20 per video** at cold start, trending toward **\$0.25–\$0.40** at steady state once a channel's rig/template cache is warm (see §45).

This document defines the systemic, architectural, database, pipeline, API, security, and operational configurations required to deploy AIVA as a robust, resilient, and horizontally scalable application — and, per §1.2, defines an explicit phased path to get there without building enterprise features before the core loop is proven.

## 1.1 Design Principles

1. **Visual type is a per-scene attribute, not a global toggle — but styles set good defaults.** A style preset (§4) configures the default mix of visual types for a project; individual scenes can still be overridden in the Timeline Studio.
2. **The renderer is style-agnostic.** Character rigs, Ken-Burns templates, and kinetic-typography templates are all "just" Remotion compositions behind one `IAnimationRenderer` interface. Adding a fifth style should mean adding a template folder, not a new subsystem.
3. **Determinism over cleverness in rendering.** The animation renderer is code-driven (React/Remotion), so identical `(template, params, timing_hash)` inputs always produce byte-identical output — enabling aggressive caching and predictable QA.
4. **Everything resumable.** Every pipeline stage persists its output before the next stage begins, so a crash never costs more than the current stage's work. This is the platform's core differentiator versus hobbyist automation scripts and is not affected by which style a project uses.
5. **Provider-agnostic by contract.** No business logic ever imports a vendor SDK directly; everything goes through an abstract provider interface, so swapping Kokoro for ElevenLabs (or Pexels for Storyblocks) is a config change, not a code change.
6. **Ship the smallest thing that proves the loop, then widen.** See §1.2.

## 1.2 Phased Delivery Strategy

This document specifies the full target architecture, including features that should **not** be built in the first release. Building all of it before validating that people want AI-generated stickman/documentary automation channels is the single biggest risk to the project — bigger than any technical decision in this document. The phases below are the intended build order; §44 (Roadmap) and every row in §7/§9 are tagged against them.

| Phase | Scope | Explicitly Excluded |
|---|---|---|
| **P1 — Prove the Loop** | Single user, single workspace, two video styles only (**stickman animation** + **documentary**), topic → research → script/direction → voice → render → download. No dashboard beyond a status page. One VPS, no auto-scaling. | Multi-tenancy, RBAC, approval gates, channel scheduling, avatar style, kinetic typography style, rig marketplace, analytics, cost dashboard. |
| **P2 — Make It Usable** | Timeline/Rig Studio UI, scene preview + approval gate, partial scene re-render, rig cloning/re-skinning, scene versioning, animation render caching, all 4 styles available. | Multi-channel scheduling, enterprise RBAC, localization, publishing automation. |
| **P3 — Make It a SaaS** | Multi-tenant workspaces, channels, RBAC, cost dashboard + cost caps, scheduled YouTube/Drive publishing, basic analytics. | Rig marketplace, enterprise compliance/audit logs, localization pipeline. |
| **P4 — Enterprise & Scale** | Multi-language localization, custom rig marketplace, branded/enterprise avatar styles, audit logs, Kubernetes-grade autoscaling, physics-based secondary motion, viseme-accurate lip sync. | — |

The rest of this document is written at full target-architecture depth (that's the point of an EDD), but nothing here should be read as "build all of this simultaneously." Section tags like **[P1]**, **[P2]**, etc. mark where a feature belongs.

---

# 2. Product Vision

To democratize YouTube automation channel production by transforming raw, unstructured text topics into production-ready videos in the creator's chosen visual language — a stickman cast acting out a story, a documentary-style narration over archival-feeling B-roll, a fast-paced kinetic-typography explainer, or an avatar narrator — without requiring animation, editing, or design skills. The platform abstracts away rigging, keyframe animation, timeline synchronization, audio engineering, and rendering, enabling a single operator to manage entire channels through a single operational dashboard.

---

# 3. Business Goals

- **Cost Minimization:** Maintain a production cost baseline in the **\$0.60–\$1.20** cold-start range (revised from an earlier, unrealistically low estimate — see §45) for a 30-minute 1080p60 video, trending down as template/rig caches warm.
- **High Resilience:** Guarantee fault-tolerant resumes for multi-hour video rendering pipelines using stateful state machines (via Temporal or state-tracked BullMQ), with a target of zero full pipeline restarts due to a single-stage failure.
- **User Retention:** Deliver an ultra-responsive UI displaying real-time rendering state changes via WebSocket connections, with sub-500ms perceived latency between backend state change and UI update.
- **Visual Flexibility:** Let a creator pick a channel-level video output style, mix visual types per scene, and switch styles between projects without re-authoring the pipeline (§4).
- **Rig/Template Reusability:** Reduce marginal rendering cost toward \$0 by making rigs and templates cacheable, versioned, shareable assets rather than per-video renders.
- **Time-to-First-Video:** A new user should be able to go from signup to their first completed, watchable video in under 35 minutes end-to-end, including account setup (see §46 for the render-time floor this depends on).

---

# 4. Video Output Styles

This is the platform's answer to "not just stickman." A **Video Output Style** is a named preset that configures the default visual language of a project: which scene visual types are used, which templates render them, and how they're paced. Styles are selected at the **channel** level (so a channel keeps a consistent identity across episodes) with an optional **per-project** override, and individual **scenes** can still be manually overridden regardless of style (the "mixed/custom" behavior from v2.0 still exists — it's just no longer the default framing).

## 4.1 Built-in Styles

| Style | `video_style` value | Primary Visual Types | Renderer Template Family | Typical Channel Genre |
|---|---|---|---|---|
| **Stickman Animation** | `stickman_animation` | `character_animation` (rig-driven), occasional `broll` as background plate | Character Rig (§19.1) | Reddit-story narration, motivational, comedic recaps |
| **Documentary** | `documentary` | `broll`, `ai_image` (both with Ken-Burns pan/zoom), occasional `kinetic_typography` for stat callouts and lower-thirds | Ken-Burns Photo/Video Template (§19.2) | History, true crime recap, science explainers |
| **Kinetic Typography** | `kinetic_typography` | `kinetic_typography` almost exclusively, occasional `ai_image` background | Kinetic Typography Template (§19.3) | Listicles, quick facts, motivational quote channels |
| **Avatar Narration** | `avatar_narration` | `avatar` primary, `broll`/`ai_image` cutaways | Avatar Template (§20) | Brand-safe enterprise explainers, corporate training |
| **Mixed / Custom** | `mixed_custom` | No defaults — every scene is manually tagged | Any | Power users who want full manual control |

## 4.2 Why One Engine Can Serve All of Them

Every style above is rendered by the same `AnimationService` worker (§19), the same `IAnimationRenderer` interface, and the same FFmpeg compositor. The only thing that changes between styles is **which Remotion component family a scene's template resolves to** and **which default pacing/camera rules apply**. This is the architectural reason a 5th or 6th style (e.g., a future "comic-panel" style) is a template addition, not a new subsystem — consistent with the provider-abstraction principle already used for LLMs/TTS/stock in v2.0, just applied one layer further into the renderer itself.

## 4.3 Style Presets Are Data, Not Code

```sql
CREATE TYPE video_style AS ENUM ('stickman_animation', 'documentary', 'kinetic_typography', 'avatar_narration', 'mixed_custom');

CREATE TABLE video_style_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = system preset
    style video_style NOT NULL,
    name VARCHAR(100) NOT NULL,
    -- visual_type_weights: probability weighting the Director Agent uses per style, e.g.
    -- {"character_animation": 0.7, "broll": 0.3} for stickman_animation
    visual_type_weights JSONB NOT NULL,
    default_rig_id UUID REFERENCES animation_rigs(id),        -- used by character_animation styles
    default_camera_pacing VARCHAR(30) DEFAULT 'medium',        -- 'slow' | 'medium' | 'fast'
    default_transition VARCHAR(30) DEFAULT 'fade',
    allow_scene_override BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
```

`channels.default_video_style` and `channels.default_style_preset_id` set the channel identity; `projects.style_preset_id` can override per-video (e.g., a normally-documentary channel doing one stickman "explainer special"). The Director Agent (§16.1) is handed the resolved preset's `visual_type_weights` and allowed template list as constraints when it tags each scene, so it never proposes a visual type the style doesn't support unless `allow_scene_override` is true and a human manually forces it in the Timeline Studio.

---

# 5. User Personas

### 5.1 Content Creator (SaaS User) — "Solo Automation Operator"

Runs 1–5 faceless "YouTube automation" channels across different genres — some stickman-narrated, some documentary-style — using the same platform. Typically manages the channel alongside a day job; values speed and low per-video cost over cinematic polish. Needs:
- A channel-level style picker that "just works" without design skills, plus the ability to try a different style on a single video without breaking the channel's identity.
- Multi-channel management with independent branding, upload schedules, and default style/rig per channel. **[P3]**
- A library of reusable stickman rigs/actions and documentary/typography templates.
- Fast iteration on scripts (accept/reject/regenerate at the scene level), with a real preview before spending on full render. **[P2]**
- Automatic YouTube uploads with scheduling, so the channel can run semi-unattended. **[P3]**
- Cost visibility per video and per channel. **[P3]**

### 5.2 Marketing Manager (Enterprise User) — "Brand-Safe Producer"

Focuses on brand safety, custom-branded animated characters or avatar narration, multi-language localization, and documentary-style B-roll for higher-polish corporate content. Needs:
- Custom asset libraries (branded rig skins, approved music, approved stock sources, branded typography templates). **[P4]**
- Approval step gates and audit trails before anything renders or publishes. **[P3]/[P4]**
- Workspace collaboration features (comments, role-based review, versioning). **[P3]**
- Compliance guardrails (no disallowed stock sources, watermarking, content moderation on generated script/imagery). **[P4]**

### 5.3 Channel Manager — "Quality Gatekeeper" (sub-role within both personas)

Reviews generated scripts and scene-level visual/style decisions — now including an actual visual preview, not just text — before spending compute/API budget on voice and rendering. Needs a fast, scannable review UI, not a full video editor. **[P2]**

---

# 6. User Stories

- _As a Content Creator_, I want to pick "Documentary" for my history channel and "Stickman Animation" for my comedy channel, using the same platform account. **[P1]**
- _As a Content Creator_, I want to submit a single topic so that I can receive a fully edited 25-minute video in my channel's chosen style, with voiceover and matching subtitles, without manual editing. **[P1]**
- _As a Content Creator_, I want to see an actual visual preview of each scene (not just text) before the platform spends compute on full-quality rendering. **[P2]**
- _As a Content Creator_, I want to clone and re-skin an existing stickman rig, or customize a kinetic-typography color/font theme, in under 5 minutes without any design experience. **[P2]**
- _As a Content Creator_, I want to see a per-scene cost estimate before I approve rendering, so I don't accidentally burn budget on a script I'll discard. **[P2]**
- _As a Content Creator_, I want to edit a scene's script and have its animation action/camera direction regenerate automatically, without re-tagging the whole video. **[P2]**
- _As an Enterprise Marketer_, I want to generate a video in English and automatically translate and voice it in Spanish and Japanese while keeping the same animation/camera timing. **[P4]**
- _As an Enterprise Marketer_, I want every generated script screened against a brand-safety/profanity filter before it reaches the voice stage. **[P3]**
- _As a Channel Manager_, I want to review the generated script, per-scene visual type, and direction (action/camera/background), and override any of them, before spending API credits on voice and video generation. **[P2]**
- _As a Channel Manager_, I want to swap a single failed or awkward scene without re-running the entire pipeline. **[P2]**
- _As an Admin_, I want a real-time dashboard of queue depth, worker health, and per-tenant cost burn so I can catch runaway jobs before they become a bill. **[P3]**

---

# 7. Functional Requirements

| ID | Requirement | Phase | Detail |
|---|---|---|---|
| FR-1 | Core Generation Loop | **P1** | Topic in → researched, scripted, directed, voiced, rendered MP4 out, downloadable. Single style at a time, no approval gates. |
| FR-2 | Style Selection | **P1** | Project-level (P1) then channel-level default (P2) selection between built-in `video_style` presets. |
| FR-3 | Stateful, Resumable Pipeline | **P1** | Run, pause, edit, resume, and restart steps within the pipeline (§16). Each stage checkpointed independently — this exists from day one, it's the architecture's core property, not a later add-on. |
| FR-4 | Provider Abstraction | **P1** | Hot-swap LLMs, TTS engines, animation renderers, image generators, and stock libraries without pipeline downtime. |
| FR-5 | Per-Scene Visual Type Override | **P2** | Each scene independently flagged as `character_animation`, `broll`, `ai_image`, `kinetic_typography`, or `avatar`; Director Agent proposes, user can override in the Timeline Studio. |
| FR-6 | Rig & Template Library | **P1 (system defaults) / P2 (management UI)** | Reusable, versioned library of stickman rigs, Ken-Burns templates, and kinetic-typography templates (§19). |
| FR-7 | Rig/Template Cloning & Re-skinning | **P2** | Users can duplicate an existing rig/template and customize palette/proportions/fonts via a no-code panel. |
| FR-8 | Interactive Timeline Editor | **P2** | Web-based timeline visualization to adjust scene transitions, swap actions/templates, modify subtitle timings, and manually swap failed stock clips. |
| FR-9 | Scene Preview Before Full Render | **P2** | Cheap, fast preview per scene generated and shown before the expensive full-quality render stage. |
| FR-10 | Approval Gates | **P3** | Configurable checkpoints (post-script, pre-render) that pause the pipeline for human review; P1/P2 ship with pipelines that run straight through. |
| FR-11 | Cost Estimation | **P2** | Pre-flight cost estimate shown before each spend-triggering stage. |
| FR-12 | Partial Re-render | **P2** | Ability to re-render a single scene without regenerating the rest of the video, reusing cached upstream artifacts. |
| FR-13 | Scene Versioning | **P2** | Edits to a scene create a new `scene_versions` row rather than overwriting history (§13.1). |
| FR-14 | Multi-Tenancy & Auth | **P3** | Secure login, team workspaces, RBAC (Owner/Editor/Viewer), per-user and per-workspace usage quotas. |
| FR-15 | Multi-language Localization | **P4** | Script translation + re-voicing pipeline that preserves scene boundaries and re-syncs timing to the new voiceover track. |
| FR-16 | Scheduled Publishing | **P3** | Queue a completed video for auto-upload to YouTube/Drive at a specified time, with per-channel OAuth credentials. |

---

# 8. Non-Functional Requirements

| Category | Requirement | Phase |
|---|---|---|
| **Scalability** | Horizontal auto-scaling of rendering workers based on Redis queue depth. | **P3** (P1/P2 run on a fixed small worker pool) |
| **Reliability** | Idempotent jobs with automatic exponential backoff retries for third-party API calls (base 2s, max 5 retries, jitter ±20%). | **P1** |
| **Performance** | Decoupled architecture ensuring heavy video/animation rendering runs on dedicated workers, protecting frontend API p95 latency under 300ms. | **P1** |
| **Durability** | No pipeline stage output is held only in worker memory; every artifact is persisted before the next stage is enqueued. | **P1** |
| **Observability** | Every job stage emits structured logs, a duration metric, and a cost metric; traceable end-to-end via a single `trace_id`. | **P1** (basic), **P3** (dashboards) |
| **Portability** | No hard dependency on a single cloud provider; Docker images run identically on a bare VPS, Coolify, or Kubernetes. | **P1** |

---

# 9. Complete Feature List

- **[P1] Core Pipeline:** Topic → research → script/direction → voice → render → download.
- **[P1] Style Selector:** Choose stickman or documentary at project creation.
- **[P1] Provider Abstraction Layer:** Swappable LLM/TTS/stock/image providers.
- **[P2] Rig & Template Library Manager:** Browse system rigs/templates, preview, clone/re-skin.
- **[P2] Interactive Script + Direction Editor:** Chunked script editor with inline scene-level visual type/action/camera controls and a diff view on regeneration.
- **[P2] Scene Preview:** Fast, cheap per-scene preview before full render.
- **[P2] Scene Versioning:** Immutable version history per scene.
- **[P2] Media Asset Manager:** Dynamic database of locally downloaded and cached B-roll, AI images, animation renders, and audio tracks, deduped by content hash.
- **[P2] Audio Engine:** Multi-track mixer (Voiceover + Background Music + SFX) with auto-ducking and loudness normalization.
- **[P2] Rendering Engine:** Headless FFmpeg-based video compiler.
- **[P2] Partial Re-render:** Re-render one scene without touching the rest.
- **[P3] Workspace Manager:** Group channels, assets, and history; per-workspace billing and quota views.
- **[P3] Metadata Generator:** Automated SEO titles, descriptions, chapters, and tags.
- **[P3] Thumbnail Generator:** SDXL-based hook image + typography overlay, A/B candidates.
- **[P3] Channel Scheduler:** Auto-upload to Google Drive/YouTube with scheduling.
- **[P3] Cost Dashboard:** Real-time per-video and per-channel spend tracking.
- **[P3] Approval Workflow:** Configurable human checkpoints with Slack/email notification hooks.
- **[P3] Admin Console:** Tenant management, worker fleet health, DLQ inspection, feature flags.
- **[P4] Rig/Template Marketplace:** Share/license custom rigs and templates across tenants.
- **[P4] Multi-language Pipeline, Enterprise Avatar Style, Audit Logs.**

---

# 10. System Architecture

The architecture decouples synchronous API operations from the asynchronous, resource-heavy processing workflows. A single, template-agnostic animation-rendering lane serves all four styles; a separate B-roll/image lane and an FFmpeg compositor round out the visual pipeline.

```
                         [Client: Next.js Frontend]
                                    │
                                    ▼ (HTTPS / WSS)
                     [API: Next.js Route Handlers] ───► [Database: Supabase PostgreSQL]
                                    │                              ▲
                                    ▼ (Enqueue Jobs)                │ (state reads)
                          [Queue: Redis / Upstash]                  │
                                    │                              │
                                    ▼ (Dequeue)                    │
                  [Distributed Worker Pool (BullMQ / Celery Supervisor)]
                       │                    │                     │
                       ▼                    ▼                     ▼
        [Worker 1: Python/FastAPI]  [Worker 2: Python/FastAPI]  [Worker 3: Node.js]
        GPU — Agent chain (LLM),   CPU — Stock APIs,             Template Render
        TTS, Whisper               embedding match, thumbnails    (character rig /
        └► Storage (S3)            └► Cache (Redis)                Ken-Burns / typography)
                                                                    └► Headless Chromium
                                                                    └► direct-to-WebM output
                       │                    │                     │
                       └────────────────────┴─────────────────────┘
                                    ▼
                     [Worker 4: FFmpeg Compositor]
                     Merges rendered segments + B-roll + audio + subtitles
                                    │
                                    ▼
                         [Storage: S3 / Supabase Storage]
                                    │
                                    ▼ (P3+)
                    [Publishing Worker: Google Drive / YouTube API]
```

## 10.1 Component Responsibilities

| Component | Responsibility | Scales On | Phase |
|---|---|---|---|
| Next.js API | Auth, CRUD, job enqueue, WebSocket fan-out | Vercel/Coolify autoscale (stateless) | P1 |
| Redis Queue | Job durability, priority, DLQ | Managed Redis (Upstash) | P1 |
| Python GPU Worker | Agent chain (Research/Outline/Script+Direction) LLM calls, Kokoro TTS, Faster-Whisper subtitle extraction | GPU node pool, queue depth | P1 |
| Python CPU Worker | Stock API queries, embedding-based B-roll matching, thumbnail composition | CPU node pool, queue depth | P1 |
| Node.js Template Worker | Template resolution (rig / Ken-Burns / typography), Remotion composition render via headless Chromium, direct-to-WebM encode | CPU node pool (Chromium is CPU-bound), queue depth | P1 |
| FFmpeg Compositor | Final multi-track assembly, subtitle burn-in, encode | GPU node pool (NVENC), queue depth | P1 |
| Publishing Worker | Drive/YouTube upload, OAuth refresh | Low concurrency, rate-limit bound | P3 |

---

# 11. Complete Technology Stack

| **Tier** | **Technology** | **Rationale** | **Alternatives Evaluated** | **Pros / Cons** |
|---|---|---|---|---|
| **Frontend** | Next.js 16 | Excellent SSR/ISR, fast routing, server components reduce client JS for dashboard views. | Remix, Vite + SPA | **Pros:** SEO friendly, good DX. **Cons:** Long-running work must stay off the request path (mitigated: all real work happens in workers). |
| **Styling** | Tailwind v4 & MUI | Fast design iterations; MUI for dense dashboard components. | Styled Components, Chakra | **Pros:** Consistent theme, fast prototyping. **Cons:** Bundle discipline needed mixing two systems. |
| **Database** | Supabase (PostgreSQL) | Native RLS, real-time tables (live job status), pgvector (B-roll/embedding search). | Plain PostgreSQL, MongoDB | **Pros:** Zero-ops setup, built-in auth. **Cons:** Some managed-feature lock-in; schema itself is portable plain Postgres. |
| **Queue** | BullMQ + Redis | Fast memory-based state manager; native retry/backoff, priority queues, DLQ support. | Celery + RabbitMQ, Temporal | **Pros:** Easy JS integration, good observability via Bull Board. **Cons:** Less rigorous saga guarantees than Temporal for very long-running flows (mitigated by DB-persisted checkpoints). |
| **Workers (ML/AV)** | Python (FastAPI) | Native integration with ML/Media libs (Whisper, Coqui, sentence-transformers, PIL). | Node.js Worker Threads | **Pros:** ML-friendly ecosystem. **Cons:** Two-language stack increases CI/CD surface area. |
| **Template Rendering Engine** | Remotion (React/Node) + Puppeteer, rendering **directly to WebM (VP9, alpha)** via `renderMedia` | Programmatic, component-based animation shared by all four styles; frame-perfect sync to voiceover timing; no PNG frame-sequence intermediate, which was the main I/O bottleneck in v2.0. | Manim, Spine/DragonBones, Lottie, After Effects scripting, PNG-sequence + separate encode | **Pros:** JS ecosystem, deterministic output, templates are versioned React components, direct WebM output avoids writing/reading thousands of PNGs per scene. **Cons:** Still CPU/Chromium-render heavy; needs a headless-Chromium pool. ProRes 4444 available as an opt-in higher-fidelity intermediate for enterprise handoff (larger files, slower). |
| **Rendering** | Headless FFmpeg | Industry-standard speed, raw command-line power; composites rendered segments, B-roll, audio, and subtitles. | MoviePy (Pure Python) | **Pros:** Unmatched speed, GPU encode support. **Cons:** Complex filter-graph syntax; mitigated with a typed command builder. |
| **TTS** | Kokoro-82M / Coqui (self-hosted) | Free, local, good enough quality for narration-heavy automation content. | ElevenLabs, Google Cloud TTS | **Pros:** \$0 marginal cost. **Cons:** Slightly lower expressiveness; offset by pairing with animation/camera emphasis. |
| **Subtitles** | Faster-Whisper (medium.en) | Local, word-level timestamps needed for subtitles, animation sync, and Ken-Burns/typography beat timing. | OpenAI Whisper API | **Pros:** No per-minute API cost. **Cons:** GPU memory footprint; batched to amortize. |
| **Object Storage** | Supabase Storage / S3-compatible | Cheap cold storage for archives; signed URLs for private assets. | Cloudflare R2 | **Pros:** No egress fees on R2 if adopted later. **Cons:** N/A — abstracted behind a storage interface. |

---

# 12. Project Folder Structure

```
aiva-monorepo/
├── apps/
│   ├── web/                          # Next.js 16 Frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (dashboard)/workspace/          # [P3]
│   │   │   │   ├── (dashboard)/templates/          # rig + Ken-Burns + typography library [P2]
│   │   │   │   ├── (dashboard)/timeline/[projectId]/
│   │   │   │   └── api/                             # Route Handlers (thin — enqueue only)
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   └── package.json
│   ├── workers/                      # Python/FastAPI Distributed Engines
│   │   ├── app/
│   │   │   ├── core/                   # FFmpeg Orchestrator & Audio Mixers
│   │   │   ├── agents/                 # Research / Outline / Script+Direction agent implementations
│   │   │   ├── providers/              # ILLMProvider, ITTSProvider, IStockProvider impls
│   │   │   ├── models/                 # Local Whisper, Coqui, SDXL, HuggingFace wrappers
│   │   │   └── pipelines/              # Stage handlers
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── template-renderer/            # Node.js Remotion + Puppeteer Template Worker
│       ├── src/
│       │   ├── templates/
│       │   │   ├── character-rig/       # Stickman / branded character rigs
│       │   │   ├── ken-burns/           # Documentary photo/video pan-zoom + lower-thirds
│       │   │   └── kinetic-typography/  # Animated text/icon templates
│       │   ├── render-server.ts         # Job consumer → Remotion renderMedia() → WebM
│       │   └── chromium-pool.ts         # Reusable headless-browser pool
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── database/                     # Supabase Schemas, Migrations & Seeds
│   ├── shared-types/                 # Shared TypeScript interfaces (Scene, Rig, Style, Job, etc.)
│   └── prompt-library/               # Versioned LLM prompt templates, shared by web + workers
└── infra/
    ├── docker-compose.yml            # Local Development Stack
    └── k8s/                          # [P3/P4] Production Kubernetes manifests (HPA per worker type)
```

---

# 13. Database Design

```
[USERS] 1─────* [WORKSPACES] 1─────* [CHANNELS] 1─────* [PROJECTS]
                     │                     │                  │
                     │                     │                  ├──* [SCENES] 1──* [SCENE_VERSIONS]
                     ▼                     ▼                  │        │
           [VIDEO_STYLE_PRESETS]  [VIDEO_STYLE_PRESETS]        │        └──► [ANIMATION_RIGS]
                                                                ├──* [JOBS]
                                                                ├──* [VIDEO_EXPORTS]
                                                                └──* [COST_LEDGER_ENTRIES]
```

## 13.1 Core Schema

```sql
-- Core Enums
CREATE TYPE video_status AS ENUM ('draft', 'queued', 'generating', 'awaiting_approval', 'rendered', 'failed', 'completed');
CREATE TYPE job_step AS ENUM (
  'research', 'outline', 'script_direction',   -- combined script + scene direction, see §16.1
  'brand_safety_check',
  'voiceover', 'subtitle_extraction',
  'scene_preview',
  'scene_render',                              -- character_animation / broll / ai_image / kinetic_typography / avatar
  'composition', 'rendering',
  'thumbnail', 'metadata', 'cost_reconciliation',
  'upload', 'notify'
);
CREATE TYPE scene_visual_type AS ENUM ('character_animation', 'broll', 'ai_image', 'kinetic_typography', 'avatar');
CREATE TYPE video_style AS ENUM ('stickman_animation', 'documentary', 'kinetic_typography', 'avatar_narration', 'mixed_custom');
CREATE TYPE rig_style AS ENUM ('stickman', 'branded_character');
CREATE TYPE approval_gate AS ENUM ('script_direction', 'scene_preview', 'none');

-- Workspaces [P3] (multi-tenant boundary — a P1/P2 deployment can run with exactly one row here)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    plan VARCHAR(30) NOT NULL DEFAULT 'starter',
    monthly_cost_cap_usd NUMERIC(10,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Workspace membership / RBAC [P3]
CREATE TYPE workspace_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'editor',
    PRIMARY KEY (workspace_id, user_id)
);

-- Channels [P3] (P1/P2 can treat "channel" and "project" as 1:1)
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    default_video_style video_style NOT NULL DEFAULT 'stickman_animation',
    default_style_preset_id UUID REFERENCES video_style_presets(id),
    approval_gates approval_gate[] NOT NULL DEFAULT ARRAY['scene_preview']::approval_gate[],
    youtube_oauth_ref TEXT,
    watermark_config JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Projects (one project = one video) [P1]
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,   -- nullable in P1 (no channel concept yet)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    topic TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    video_style video_style NOT NULL DEFAULT 'stickman_animation',
    style_preset_id UUID REFERENCES video_style_presets(id),
    status video_status NOT NULL DEFAULT 'draft',
    cost_accumulated NUMERIC(10, 4) DEFAULT 0.0000,
    duration_target_minutes SMALLINT DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Scenes [P1] — points at the current version; edits create new scene_versions rows instead of overwriting
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sequence_number INT NOT NULL,
    current_version_id UUID,   -- FK added after scene_versions exists (see below)
    voiceover_url TEXT,
    voiceover_word_timings JSONB,
    preview_url TEXT,           -- [P2] fast/cheap preview asset
    render_url TEXT,            -- final full-quality rendered segment
    render_status video_status NOT NULL DEFAULT 'draft',
    duration NUMERIC(6, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (project_id, sequence_number)
);

-- Scene Versions [P2] — immutable; every script/direction edit appends a row here
CREATE TABLE scene_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    script_segment TEXT NOT NULL,
    visual_type scene_visual_type NOT NULL,
    animation_rig_id UUID REFERENCES animation_rigs(id),   -- used when visual_type = character_animation
    animation_action VARCHAR(64),                           -- e.g. 'walk_left', 'argue_intense'
    typography_template VARCHAR(64),                        -- used when visual_type = kinetic_typography
    camera_style VARCHAR(32),                                -- e.g. 'pan_left_slow', 'zoom_in_slow' (broll/ai_image)
    background_broll_url TEXT,                               -- optional plate behind an alpha template render
    transition VARCHAR(32) DEFAULT 'fade',
    emotional_tone VARCHAR(32),
    broll_search_keywords TEXT,
    visual_prompt TEXT,                                      -- used when visual_type = ai_image
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (scene_id, version_number)
);
ALTER TABLE scenes ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES scene_versions(id);

-- Animation Rigs [P1: system defaults / P2: management UI]
CREATE TABLE animation_rigs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = shared/system rig
    cloned_from_rig_id UUID REFERENCES animation_rigs(id),
    name VARCHAR(100) NOT NULL,
    style rig_style DEFAULT 'stickman',
    available_actions TEXT[] NOT NULL,
    rig_config JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Video Style Presets [P1: system defaults / P3: workspace-custom]
-- (full definition in §4.3)

-- Rendered-segment cache, generalized across all template families [P2]
CREATE TABLE render_cache (
    cache_key TEXT PRIMARY KEY,   -- sha256(template_family + template_ref + params + timing_hash)
    template_family VARCHAR(30) NOT NULL,  -- 'character_rig' | 'ken_burns' | 'kinetic_typography'
    output_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Distributed Jobs [P1]
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    current_step job_step NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    attempt_count INT NOT NULL DEFAULT 0,
    error_log TEXT,
    state_payload JSONB,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Video Exports [P3] (multi-language re-exports)
CREATE TABLE video_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    file_url TEXT,
    youtube_video_id TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Cost Ledger [P1: basic logging / P3: dashboard]
CREATE TABLE cost_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_step job_step NOT NULL,
    provider VARCHAR(60) NOT NULL,
    amount_usd NUMERIC(10, 5) NOT NULL,
    units_consumed NUMERIC(12, 4),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
```

## 13.2 Row Level Security (RLS) Policies [P3]

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE animation_rigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their workspace"
ON workspaces FOR SELECT TO authenticated
USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can access projects in their workspace's channels"
ON projects FOR ALL TO authenticated
USING (channel_id IN (
  SELECT c.id FROM channels c
  JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
  WHERE wm.user_id = auth.uid()
));

CREATE POLICY "Rigs visible if system-owned or in-workspace"
ON animation_rigs FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));
```

## 13.3 Indexing Strategy

```sql
CREATE INDEX idx_scenes_project_seq ON scenes (project_id, sequence_number);
CREATE INDEX idx_scene_versions_scene ON scene_versions (scene_id, version_number DESC);
CREATE INDEX idx_jobs_project_step ON jobs (project_id, current_step);
CREATE INDEX idx_cost_ledger_project ON cost_ledger_entries (project_id, job_step);
CREATE UNIQUE INDEX idx_render_cache_key ON render_cache (cache_key);
```

---

# 14. Authentication Flow

AIVA leverages **Supabase Auth** for tenant isolation. **[P1]** ships with a single-user/single-workspace auth model (email + password or magic link, no team features). **[P3]** adds OAuth2 (Google/GitHub) and workspace membership resolution.

1. User authenticates via Supabase Auth.
2. Supabase issues a short-lived JWT (access token, 1 hour) + refresh token.
3. Next.js middleware validates the JWT signature and expiry on every request.
4. **[P3]** `workspace_id` context is resolved from `workspace_members` and attached to the request context (used by RLS and quota checks).
5. Worker processes never handle raw user JWTs — the API layer exchanges the request into an internal service token scoped to a single `project_id` before enqueuing a job.

---

# 15. Project Creation Workflow

1. User enters a topic and picks a video style (or accepts the channel default, once channels exist in P3) → System creates a new entry in `projects` with status `draft`.
2. **[P2]** System runs a pre-flight cost estimate (word count target → estimated TTS seconds → estimated scene count → estimated render minutes, using the Cold Start figures in §45) and displays it before enqueue.
3. UI triggers the pipeline (§16), respecting configured `approval_gates` (**[P3]**; P1/P2 pipelines run straight through by default).

---

# 16. Video Generation Pipeline

## 16.1 Agent Chain

The script and direction stages are reframed as a named agent chain, per review feedback, rather than a loose sequence of LLM calls:

```
Research Agent  → gathers sources per outline point (web search tool)
      │
      ▼
Outline Agent   → turns research into a structured N-point outline, style-aware
                   (documentary outlines skew toward chronological/causal structure;
                    stickman outlines skew toward scene/beat structure)
      │
      ▼
Script + Director Agent  → ONE combined LLM call that writes the narrative text AND
                            tags each scene's visual_type, template action/camera/background,
                            transition, and emotional_tone in the same JSON response
      │
      ▼
Renderer  → scene_preview, then scene_render (§16.2)
```

**Why one combined call instead of a separate "Director Agent" call:** an earlier design ran scene tagging as a distinct pass after script generation (and a further separate "Action Classifier" as a fallback). That's an extra round-trip for information the script-writing model already has fully in context — it knows the narrative beat, tone, and subject of each scene as it writes it. Merging the two removes a full LLM call per script, which is strictly cheaper and simpler with no quality loss. `IDirectorAgent` is still defined as its own interface (§30) so a specific style (e.g., a future style needing heavier shot-planning) can split it back out into a separate, richer call without changing anything else in the pipeline.

The **only** place a standalone direction call still exists is scene-level re-direction: when a human edits one scene's script text after the fact, only that scene needs its action/camera/transition re-tagged — re-running the full Script+Director Agent over the whole video would be wasteful. See §16.3.

## 16.2 Pipeline Stages

```
1.  research              → Research Agent
2.  outline                → Outline Agent
3.  script_direction        → Script + Director Agent (combined)
    ── [approval gate: script_direction, P3] ──
4.  brand_safety_check      → profanity / policy filter on final script [P3]
5.  voiceover                 → TTS per scene (Kokoro/Coqui, fallback GCP/Edge-TTS)
6.  subtitle_extraction       → Faster-Whisper word-level timestamps on master VO track
7.  scene_preview              → cheap/fast preview per scene (§23) [P2]
    ── [approval gate: scene_preview, P2/P3] ──
8.  scene_render                → full-quality render per scene (character_animation /
                                    broll / ai_image / kinetic_typography / avatar),
                                    cache-checked first (§19.5)
9.  composition                  → Timeline Builder assembles JSON timeline
10. rendering                     → FFmpeg composites all tracks, burns subtitles, encodes final MP4
11. thumbnail                      → Keyframe extraction + SDXL hook image + typography [P3]
12. metadata                        → SEO titles/description/chapters/tags [P3]
13. cost_reconciliation               → Sum cost_ledger_entries, write final project cost [P1 basic, P3 dashboard]
14. upload                             → Push to Drive and/or YouTube [P3]
15. notify                              → WebSocket + email/Slack notification [P1 WebSocket, P3 email/Slack]
```

This is down from the previous 17-stage list: `scene_tagging` was folded into stage 3, and `avatar_render`/`image_generation` are now sub-cases of the single generalized `scene_render` stage (§16.2 item 8) rather than separate top-level stages, since they're all just different renderers behind `IAnimationRenderer` / `IImageProvider`. A new `scene_preview` stage was added per the missing-preview feedback.

Each stage corresponds to a `job_step` value and is independently retryable; `jobs.state_payload` stores enough context to resume from that exact stage without re-running earlier ones.

## 16.3 Partial Re-direction (Scene Edit Flow) **[P2]**

```
[User edits scene N's script_segment in Timeline Studio]
        │
        ▼
[Create new scene_versions row for scene N] (script text updated, visual metadata copied forward)
        │
        ▼
[Re-direction call] ──► single small LLM call, scoped to scene N only:
                          re-derives visual_type / action / camera / transition / emotional_tone
                          for the new text, using the same style constraints as the original pass
        │
        ▼
[scene.current_version_id updated] → scene_preview regenerated for scene N only → re-approve → scene_render for scene N only
```

Nothing downstream of scene N is touched; the rest of the video's cached renders remain valid.

---

# 17. Voice Generation Workflow

To hit the cost target in §45, standard paid systems like ElevenLabs are avoided for long scripts by default.

- **Default Provider:** Self-hosted **Coqui TTS** or **Kokoro-82M** running directly on the Python GPU Worker (\$0 per execution cost). Voices are pre-selected per channel to maintain consistency across episodes.
- **Cloud Fallback:** Google Cloud Text-to-Speech (Wavenet voices) or Edge-TTS (uncapped, free API wrapper), triggered automatically if the self-hosted queue depth exceeds a configurable threshold.
- **Loudness normalization:** Every scene's voiceover is normalized to -16 LUFS before mixing, then the master track is normalized to -14 LUFS for YouTube's loudness target.
- Word-level timestamps are stored per scene (`scene_versions` carries the script; timings live on `scenes.voiceover_word_timings`) and passed to the template renderer for sync (§19.4).

---

# 18. Video Output Style Rendering Detail

This section replaces the v2.0 "Stickman Animation Workflow" with a generalized version covering all four styles, since the reviewer's core critique — and the product change — was that a single character-rig system shouldn't be the whole story.

## 19. Programmatic Template Engine

```
[Scene: script_segment + visual_type (from scene_versions)]
        │
        ▼
[Cache Lookup] ──► sha256(template_family + template_ref + params + timing_hash)
        ├──► HIT: return cached segment URL, skip render entirely
        └──► MISS: continue ▼
[Template Resolver] ──► loads the correct component family based on visual_type:
        ├── character_animation → Character Rig template (§19.1)
        ├── ai_image / broll (with camera_style set) → Ken-Burns template (§19.2)
        └── kinetic_typography → Kinetic Typography template (§19.3)
        ▼
[Remotion Composition] ──► binds word-level voiceover timestamps to keyframes/camera moves
        ▼
[Headless Chromium Render (Puppeteer, pooled instances)] ──► renderMedia() direct to WebM (VP9, alpha) @ project fps
        ▼
[Cache Write] ──► render_cache row created for future reuse
        ▼
[Timeline Builder] ──► composites into master timeline alongside B-roll/audio tracks
```

### 19.1 Character Rig Template (used by `stickman_animation` style, `character_animation` visual type)

A rig is a set of reusable limb/joint SVG components with named actions. Example `rig_config` payload:

```json
{
  "skeleton": {
    "joints": ["head", "torso", "left_shoulder", "left_elbow", "left_hand",
               "right_shoulder", "right_elbow", "right_hand",
               "left_hip", "left_knee", "left_foot",
               "right_hip", "right_knee", "right_foot"],
    "bone_lengths_px": { "torso": 120, "upper_arm": 60, "forearm": 55, "thigh": 70, "shin": 65 }
  },
  "palette": { "stroke": "#1A1A1A", "fill": "#FFFFFF", "accent": "#3B82F6" },
  "component_ref": "templates/character-rig/default_stickman/Rig.tsx",
  "actions": {
    "idle_talk":     { "keyframes_ref": "actions/idle_talk.json",     "loopable": true,  "syncs_to": "phoneme" },
    "walk_left":      { "keyframes_ref": "actions/walk_left.json",     "loopable": true,  "syncs_to": "beat" },
    "point_forward":  { "keyframes_ref": "actions/point_forward.json", "loopable": false, "syncs_to": "emphasis_word" },
    "argue_mild":     { "keyframes_ref": "actions/argue_mild.json",    "loopable": true,  "syncs_to": "phoneme" },
    "argue_intense":  { "keyframes_ref": "actions/argue_intense.json", "loopable": true,  "syncs_to": "phoneme" },
    "celebrate":      { "keyframes_ref": "actions/celebrate.json",     "loopable": false, "syncs_to": "none" },
    "shrug":          { "keyframes_ref": "actions/shrug.json",         "loopable": false, "syncs_to": "none" },
    "sit_idle":       { "keyframes_ref": "actions/sit_idle.json",      "loopable": true,  "syncs_to": "phoneme" }
  }
}
```

**Action Taxonomy (System Default Rig):**

| Category | Actions | Typical Scene Match |
|---|---|---|
| Locomotion | `walk_left`, `walk_right`, `run`, `stand_idle` | Scene-setting, travel, time-skips |
| Conversational | `idle_talk`, `point_forward`, `shrug`, `nod`, `head_shake` | Dialogue, explanation, opinion |
| Emotional (positive) | `celebrate`, `laugh`, `wave` | Resolution, good news, comedy beats |
| Emotional (negative) | `argue_mild`, `argue_intense`, `cry`, `facepalm` | Conflict, bad news, frustration |
| Reactive | `surprised_jump`, `look_around`, `flinch` | Twists, reveals, sudden events |
| Stationary | `sit_idle`, `lean_wall`, `cross_arms` | Reflection, waiting, internal monologue |

New actions are added by dropping a new keyframe JSON into `actions/` and registering it in a rig's `available_actions` array — no renderer or schema changes required.

**Background & mixing:** Rig segments render with an alpha channel, so a `character_animation` scene can sit over a `background_broll_url` plate, letting stickman and B-roll mix within one scene.

**Voice-sync mechanics:** `syncs_to: "phoneme"` actions approximate mouth-open/closed states from voiceover amplitude within each word's `[start, end]` window (not full viseme mapping — sufficient at stickman scale). `syncs_to: "emphasis_word"` actions (like `point_forward`) trigger their peak at the timestamp of an LLM-flagged emphasis word. `syncs_to: "beat"` actions loop at a fixed cadence for the scene's duration. `syncs_to: "none"` actions play once and hold their final pose.

### 19.2 Ken-Burns Photo/Video Template (used by `documentary` style, `broll`/`ai_image` visual types)

Documentary-style scenes use the same Remotion renderer, but the "rig" is replaced by a compositional template that:
- Applies a slow, randomized-within-bounds pan/zoom (Ken Burns effect) over the selected B-roll clip or AI-generated image, avoiding repetitive motion across a 20-minute video.
- Optionally overlays a **lower-third caption** (e.g., a name, date, or statistic pulled from `visual_prompt`/`broll_search_keywords`) using the Kinetic Typography template as a nested component.
- Supports an archival-photo color-grade filter (desaturation + slight vignette + film-grain overlay) as an optional `camera_style` variant, for a period-documentary feel.
- `camera_style` values: `pan_left_slow`, `pan_right_slow`, `zoom_in_slow`, `zoom_out_slow`, `static_hold` — chosen by the Director Agent per scene, weighted by the style preset's `default_camera_pacing`.

### 19.3 Kinetic Typography Template (used by `kinetic_typography` style, and as a nested overlay in documentary)

- Renders animated text (word-by-word or phrase-by-phrase reveal, synced to `voiceover_word_timings`) with simple icon accents pulled from a small built-in icon set matched by keyword.
- `typography_template` values select a font/animation-motion pairing (e.g., `bold_pop`, `clean_slide`, `handwritten_reveal`).
- No character or B-roll required, making this the cheapest style to render (smallest Chromium workload per scene) — useful to note for cost modeling in §45.

### 19.4 Direct-to-WebM Rendering (all templates)

Per the review feedback on PNG frame sequences: the template worker calls Remotion's `renderMedia()` with `codec: 'vp9'` and `pixelFormat: 'yuva420p'` to encode straight to a WebM file with an alpha channel, entirely skipping the PNG-sequence intermediate used in v2.0. This removes the dominant disk I/O cost on constrained VPS hardware (thousands of small PNG writes/reads per scene) and reduces peak local disk usage during rendering. For workflows that need a lossless intermediate for further post-production (mainly relevant to enterprise/documentary handoff in **[P4]**), ProRes 4444 with alpha is available as an opt-in `output_codec` setting — larger files and slower encode, but non-lossy for downstream editing.

### 19.5 Determinism & Caching (generalized)

Because rendering is code-driven, the same `(template_family, template_ref, params, timing_hash)` always produces byte-identical output, enforced by:
1. Pinning rig/template version at script-generation time so a mid-project edit doesn't silently change already-rendered scenes.
2. Hashing the exact word-timing array used for sync, so cache entries are only reused when voiceover timing genuinely matches.
3. A background job that evicts `render_cache` entries unused for 30+ days.

Cache hit rate is the dominant cost/time lever across all four styles, but especially for `stickman_animation` and `kinetic_typography` channels that reuse a small, stable action/template vocabulary — see §45.1.

---

# 20. Avatar Narration Workflow (`avatar_narration` style) **[P4]**

For Enterprise Marketer users who want a talking-head narrator as the primary style rather than a supplementary add-on:

- The system calls the external Provider API (e.g., Tavus/HeyGen).
- The API returns a `rendering_task_id`.
- An internal worker polls the status or listens via webhook to download the green-screen video.
- FFmpeg runs a chroma-key filter (`colorkey=0x00FF00:0.1:0.2`) to overlay the avatar onto the chosen background (which can itself be a Ken-Burns or kinetic-typography scene, since compositing is style-agnostic).
- Cost and latency are both materially higher than the other three styles, so this remains gated as an enterprise-tier feature and is excluded from the default cost baseline in §45.

---

# 21. Image Generation Workflow

- **Engine:** Self-hosted **Stable Diffusion XL (SDXL)** on local workers, or **Cloudflare Workers AI** (~\$0.001/image). Used for `ai_image` scenes (documentary style) or as static backgrounds behind character-rig scenes.
- **Prompt Optimization:** Prompts are auto-refined by the Script+Director Agent, appending style-appropriate variables — "cinematic, 8k resolution, photorealistic, archival photograph style" for documentary `ai_image` scenes, or "flat vector background, minimal, muted palette, no characters" when the image sits behind a character-rig scene.

---

# 22. B-roll Workflow

```
[Extract Scene Keywords]
        │
        ▼
[Query Pexels/Pixabay APIs] ──► [Cache Check: Exists locally?]
        ├──► YES: [Retrieve from Storage]
        └──► NO:  [Download & Process] ──► [Save to Cache DB/Storage]
```

**Matching Algorithm:** Sentence embeddings (`sentence-transformers`) compare the scene's script text against stock database tags, selecting the highest-cosine-similarity clip above a 0.75 floor; below that, the system falls back to `ai_image` generation rather than using a poor match. B-roll clips also feed the Ken-Burns template (§19.2) as the pan/zoom source, and can serve as a background plate behind a character-rig scene.

---

# 23. Scene Preview & Approval Workflow **[P2]**

Directly addresses the missing-preview feedback: previously the only pre-render checkpoint was the text script, with no visual to judge.

```
[scene_render inputs ready: script text, visual_type, action/camera/template params]
        │
        ▼
[Fast Preview Generation]
   ├── character_animation → single representative keyframe pose rendered at full resolution
   │                          (not a full animated pass — a static "hero frame" of the chosen action)
   ├── broll                → the actual matched clip's thumbnail, no processing
   ├── ai_image              → a fast low-step SDXL draft pass (fewer diffusion steps, lower res)
   └── kinetic_typography     → a compressed, low-res proof render (typography is cheap enough to
                                 render in near-full-fidelity even as a "preview")
        │
        ▼
[scenes.preview_url updated] ──► shown inline in the Timeline Studio
        │
        ▼
── [approval gate: scene_preview] ──
        │
        ▼
[scene_render: full-quality render triggered only after approval]
```

This ordering ensures the expensive stage (full `scene_render`, especially character-rig animation and full-step SDXL) never runs on a scene the user would have rejected anyway.

---

# 24. Timeline Builder

```json
{
  "timeline": {
    "dimensions": { "width": 1920, "height": 1080, "fps": 60 },
    "audio_tracks": [
      { "id": "voiceover_combined", "file": "/audio/vo_master.wav", "volume": 1.0 },
      { "id": "bg_music", "file": "/audio/music.mp3", "volume": 0.12, "ducking": { "threshold": -20 } }
    ],
    "video_tracks": [
      { "scene": 1, "type": "character_animation", "file": "/video/scene1_anim.webm", "background_broll": null, "start": 0.0, "end": 12.4, "transition": "fade" },
      { "scene": 2, "type": "broll", "file": "/video/scene2_kenburns.mp4", "start": 12.4, "end": 25.1, "transition": "cut" },
      { "scene": 3, "type": "kinetic_typography", "file": "/video/scene3_typo.webm", "start": 25.1, "end": 32.0, "transition": "fade" }
    ]
  }
}
```

The Timeline Builder is also the artifact rendered in the **Interactive Timeline Studio** — this JSON is the single source of truth for both the FFmpeg compositor and the frontend preview player, and can mix visual types freely regardless of the project's overall style.

---

# 25. Video Rendering Pipeline

Final assembly runs via **raw multi-threaded FFmpeg commands**, compositing pre-rendered WebM segments (some with alpha) over background layers and B-roll clips.

```bash
ffmpeg -y -f concat -safe 0 -i concat_list.txt \
  -i /shared/audio/vo_master.wav \
  -i /shared/audio/bg_music.mp3 \
  -filter_complex "[2:a]volume=0.15[bg]; [1:a][bg]amix=inputs=2:duration=first[audio_out]; \
  [0:v]subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF'[v_sub]" \
  -map "[v_sub]" -map "[audio_out]" \
  -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k \
  /shared/output/final_render_1080p.mp4
```

For scenes with an alpha-channel WebM composited over a background plate, an overlay pass runs per scene before the concat step:

```bash
ffmpeg -y -i background.mp4 -i character_scene.webm \
  -filter_complex "[0:v][1:v]overlay=format=auto" \
  -c:v h264_nvenc -preset p4 \
  /shared/tmp/scene3_composited.mp4
```

GPU encoding (`h264_nvenc`) is preferred where available; the compositor falls back to `libx264` automatically if no GPU worker is free within the queue-depth threshold, trading render time for throughput.

---

# 26. Subtitle Generation

The master voiceover track is parsed through **Faster-Whisper** (`medium.en`), exporting word-level `.srt` subtitles — the same timing data drives character-rig mouth-flap, Ken-Burns pan beats, and kinetic-typography word reveals, so all three stay in sync with each other by construction.

---

# 27. Thumbnail Generation **[P3]**

- 3 key frame candidates extracted from the generated video, prioritizing high-energy moments (a `celebrate`/`surprised_jump`/`argue_intense` rig action, or a fast-zoom Ken-Burns frame).
- SDXL image-to-image pass generates an engaging background hook.
- PIL overlays sharp, highly visible typography based on the video title.
- Two thumbnail variants generated per video for manual A/B selection.

---

# 28. Metadata Generation **[P3]**

| Element | Generation Prompt / Context Constraint |
|---|---|
| SEO Titles | Generate 3 click-worthy YouTube titles under 60 chars containing key target search keywords. |
| Descriptions | Generate a detailed, SEO-friendly description containing timeline chapters and social links. |
| Chapters | Synthesized directly using absolute timestamps from each scene's audio duration. |
| Tags | Up to 15 relevant tags, deduplicated against a channel-level tag blocklist. |

---

# 29. Google Drive Export **[P3]**

The publishing worker mounts the user's encrypted Google Drive credentials and splits large exports into multi-part chunks via the Drive chunked upload API (`/upload/drive/v3/files?uploadType=resumable`), with automatic resume on interruption.

---

# 30. YouTube Export **[P3]**

Designed around OAuth2 offline refresh token exchanges, maintaining a daemon that polls scheduled publication times and pushes processed binaries to `/youtube/v3/videos`, including thumbnail and chapter/description metadata in the same publish transaction.

---

# 31. Queue Architecture

- **System Engine:** BullMQ backed by a high-throughput Redis instance, with separate named queues per stage type (`llm-queue`, `tts-queue`, `template-render-queue`, `broll-queue`, `render-queue`, `publish-queue`) so GPU-bound and CPU-bound work scale independently. **[P1: single shared queue is fine at low volume; split into named queues by P3.]**
- **Priority:** Approval-gate-unblocked jobs get higher priority than newly-submitted jobs, to avoid starving in-progress projects. **[P3]**
- **Worker Strategy:** Workers run in isolated Docker containers. If a node fails, the workflow resumes from the last completed state step stored in the database.
- **Dead-Letter Queues:** Jobs with persistent failures (3+ retries exhausted) go to a DLQ for admin investigation. **[P3]**
- **Rate Limiting:** Per-provider concurrency caps enforced at the queue level.

---

# 32. Provider Abstraction Layer

```typescript
export interface ILLMProvider {
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
  generateJSON<T>(prompt: string, jsonSchema: object): Promise<T>;
}

export interface IDirectorAgent {
  // executes inside the combined Script+Direction call by default; kept as its own
  // interface so a style can later split it into a separate, richer call without
  // changing the pipeline shape.
  directScene(sceneText: string, style: VideoStyle, allowedTemplates: string[]): Promise<SceneDirection>;
}

export interface ITTSProvider {
  synthesize(text: string, voiceId: string): Promise<{ audioUrl: string; wordTimings: WordTiming[] }>;
}

export interface IStockProvider {
  search(keywords: string, minDurationSec: number): Promise<StockClip[]>;
}

export interface IAnimationRenderer {
  // templateFamily: 'character_rig' | 'ken_burns' | 'kinetic_typography'
  renderScene(templateFamily: string, templateRef: string, params: object, timestamps: WordTiming[]): Promise<string>;
}

export interface IImageProvider {
  generate(prompt: string, style: "photorealistic" | "flat_vector_bg" | "archival"): Promise<string>;
}

export interface IPublisher {
  upload(videoPath: string, metadata: VideoMetadata, channelCredentials: OAuthRef): Promise<string>;
}
```

Each provider interface has at least one self-hosted/free implementation and one paid fallback implementation, selected via per-workspace config rather than environment-level constants.

---

# 33. Prompt Library

**SYSTEM: Script + Director Agent Prompt** (combined call, see §16.1)

You are a master YouTube automation-channel scriptwriter and visual director, specializing in high-retention narration in the style requested.

Your output must strictly conform to valid JSON following the schema requested. For every scene, in the same pass as writing the narrative text, decide: `visual_type` (constrained to the allowed types for the given style), and the appropriate template parameters — `animation_action` (from the provided rig action list, for `character_animation`), `camera_style` (for `broll`/`ai_image`), or `typography_template` (for `kinetic_typography`) — plus `transition` and `emotional_tone`. Never invent a template parameter not in the provided allowed list. Do not include any conversational preamble or markdown codeblocks in your final response.

**USER: Script + Director Agent Prompt**

```
Topic: {topic}
Language: {language}
Video Style: {video_style}
Style Constraints: {visual_type_weights, allowed_templates, default_camera_pacing}
Duration Target: 20 minutes (approx. 3000 words)
Available rig actions (if style uses character_animation): {rig_action_list}
Available typography templates (if style uses kinetic_typography): {typography_template_list}
Brand safety constraints: {workspace_content_policy}
```

Format your response to divide this script into at least 15 granular scenes, each fully directed in the same pass.

**SYSTEM: Scene Re-direction Prompt** (used only for the §16.3 edit flow — a single scene, not the whole script)

Given one edited scene's narrative text, its video style, and the same allowed-template constraints as the original script, re-derive its `visual_type` and template parameters. Respond with only the JSON object for this one scene.

**SYSTEM: Brand Safety Filter Prompt [P3]**

Review the following script for profanity, hate speech, medical/legal claims, or anything violating the supplied content policy. Respond in JSON: `{ "passed": boolean, "flagged_scenes": [scene_numbers], "reason": string | null }`.

---

# 34. API Design

```
POST   /api/v1/projects                         -- Initiates video creation project (includes video_style).
GET    /api/v1/projects/:id/status              -- Returns workflow progress (also available via WSS).
PATCH  /api/v1/projects/:id/scenes/:sceneId      -- Edits scene text; triggers §16.3 re-direction flow.
GET    /api/v1/projects/:id/scenes/:sceneId/versions -- Lists immutable scene_versions history. [P2]
POST   /api/v1/projects/:id/approve/:gate        -- Unblocks a paused approval gate. [P3]
POST   /api/v1/projects/:id/scenes/:sceneId/rerender -- Triggers a partial re-render of one scene. [P2]

GET    /api/v1/styles                            -- Lists built-in and workspace video_style_presets.
POST   /api/v1/styles                            -- Registers a custom style preset. [P3]

GET    /api/v1/rigs                              -- Lists available stickman/branded rigs and their actions.
POST   /api/v1/rigs                              -- Uploads/registers a custom rig. [P2]
POST   /api/v1/rigs/:id/clone                    -- Clones a rig for re-skinning. [P2]

GET    /api/v1/channels                          -- Lists channels in the current workspace. [P3]
POST   /api/v1/channels                          -- Creates a channel with a default video style. [P3]

GET    /api/v1/cost-ledger?projectId=            -- Line-item cost breakdown for a project. [P3]
GET    /api/v1/admin/queues                      -- Queue depth, DLQ size, worker health. [P3]
```

All endpoints are thin: they validate input, write to Postgres, and enqueue a job — no heavy computation happens inside a Next.js request handler.

---

# 35. Frontend Pages

- **[P1] Project Status Page:** A single view showing pipeline progress and a download link when done — this is the entire P1 frontend beyond the topic-submission form.
- **[P2] Interactive Timeline Studio:** Split-view with the script/direction editor (per-scene visual-type/template pickers) on the left and the scene preview/render sequence on the right.
- **[P2] Rig & Template Library Manager:** Browse system + custom rigs/templates, preview actions or typography motions, clone/re-skin.
- **[P3] Workspace Overview:** List of projects, status badges, per-project cost badge.
- **[P3] Channel Settings:** Approval gates, default style/rig, YouTube OAuth connection, watermark upload.
- **[P3] Cost Dashboard:** Per-project and per-channel spend over time, broken down by stage and provider.
- **[P3] Admin Console:** Tenant list, queue/worker health, DLQ inspector with one-click retry.

---

# 36. Backend & Supporting Services

**Backend Services (Next.js API layer)**
- `ProjectService` — metadata/security, cost pre-flight estimation **[P1/P2]**
- `ResearchService` — outline + source-gathering orchestration **[P1]**
- `QueueService` — job enqueue, state tracking, WebSocket fan-out **[P1]**
- `ApprovalGateService` — pause/resume logic for configured checkpoints **[P2/P3]**

**Worker Services (Python + Node.js)**
- `AudioService` — TTS dispatch, loudness normalization, mixing **[P1]**
- `TemplateRenderService` — dispatches to the Node.js Remotion/Puppeteer renderer across all template families, manages Chromium pool **[P1]**
- `BrollService` — stock query, embedding match, local cache **[P1]**
- `FFmpegService` — composition and final encode **[P1]**
- `PublishingService` — Drive/YouTube upload, OAuth refresh **[P3]**

---

# 37. Platform Extensibility

- **Settings Page:** Configures custom API tokens and fallback engines per workspace. **[P3]**
- **Multi-Language Support:** Automatic localized script translation and region-specific TTS routing; timing re-syncs automatically to the new voiceover track. **[P4]**
- **Multi-Channel Support:** Isolated OAuth credentials, watermarks, and default style/rig per channel. **[P3]**
- **Custom Rig/Template Marketplace:** The `workspace_id NULL = system asset` pattern already used for rigs and style presets leaves room for a `visibility` column (`private | workspace | public`) without a core-table migration. **[P4]**
- **New Style Addition:** Adding a fifth built-in style is: (1) a new `video_style` enum value, (2) a new template folder under `apps/template-renderer/src/templates/`, (3) a `video_style_presets` row with its default `visual_type_weights`. No pipeline, database core-table, or renderer-interface changes required — this is the direct payoff of generalizing the renderer in this revision.

---

# 38. Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| Third-party API rate limit / timeout | Non-2xx or timeout on provider call | Exponential backoff with jitter (base 2s, max 5 retries) |
| Stock clip download fails or file corrupted | Checksum/ffprobe validation post-download | Query alternate stock provider; if still unmatched, fall back to `ai_image` for that scene |
| Template render fails (Chromium crash/OOM) | Non-zero exit from Puppeteer render process | Retry with a simplified template variant (e.g., fewer simultaneous animated joints, or a static-hold camera instead of a pan); after 2 failures, fall back to a static `ai_image` scene |
| TTS provider unavailable | Health-check failure on self-hosted Kokoro/Coqui | Automatic failover to Google Cloud TTS / Edge-TTS fallback |
| FFmpeg encode failure | Non-zero exit code | Retry with `libx264` software encode if `h264_nvenc` failed |
| Approval gate timeout **[P3]** | No reviewer action within configurable SLA | Notification escalation; project remains safely paused, no auto-proceed on spend-gated stages |
| Partial pipeline crash (worker killed mid-stage) | Job heartbeat missed | BullMQ's stalled-job detection re-queues from last DB-persisted checkpoint, never from stage start |

---

# 39. Caching & Storage

- **Caching:** Stock search keyword results cached in Redis for 7 days. Downloaded videos hashed (MD5) for dedup. Rendered template segments cached by `(template_family, template_ref, params, timing_hash)` (§19.5) — the single largest cost/time lever in the system.
- **Storage tiers:** High-speed NVMe local volumes for in-flight rendering; Supabase Storage/S3 warm tier for recently completed videos (30 days); S3 cold/Glacier-class tier beyond that. **[P3 for tiered lifecycle policies; P1/P2 can use a single warm tier.]**
- **Cache eviction:** LRU eviction on `render_cache` for entries unused 30+ days; B-roll cache capped by disk quota with least-recently-used eviction. **[P2]**

---

# 40. Security, Performance & Scaling

- **Security:** PostgreSQL RLS for workspace security (§13.2, **[P3]**); AES-256-GCM for third-party API keys and OAuth refresh tokens, rotated quarterly; service-to-worker tokens scoped to a single `project_id` to limit blast radius of a compromised worker. **[P1]**
- **Performance:** Non-blocking I/O (`asyncio`) and GPU acceleration (`h264_nvenc`) for FFmpeg; headless Chromium instances pooled and reused across render jobs (target: < 800ms to acquire a warm browser context). **[P1]**
- **Scaling Strategy:** Next.js on Vercel/Coolify, Python and Node.js workers in Docker with auto-scaling based on Redis queue length per named queue, so a spike in demand for one style's rendering doesn't force-scale the whole fleet. **[P3]**
- **Cost Guardrails:** Per-workspace `monthly_cost_cap_usd` enforced at enqueue time. **[P3]**

---

# 41. DevOps & Quality Assurance

- **Monitoring & Logging:** Sentry for exceptions, Prometheus/Grafana for resource usage (per worker pool, per named queue, `render_cache` hit rate). Structured JSON logging correlated by `trace_id`. **[P1 basic logging, P3 full dashboards]**
- **Alerting:** Slack/PagerDuty alerts on DLQ growth, worker saturation, cost-cap approach. **[P3]**
- **Testing Strategy:**
  - **PyTest** — core pipeline logic, provider implementations. **[P1]**
  - **Jest** — frontend components and Remotion compositions across all three template families (snapshot-testing rendered frames for regression detection on rig/template changes). **[P2]**
  - **Playwright** — E2E workflows (topic submission → preview approval → completed video). **[P2]**
  - **Visual regression** — a nightly job re-renders a fixed reference-scene set per template family and diffs output against a golden baseline. **[P2]**

---

# 42. Deployment Guide

```
[GitHub Repository] ──► (Push) ──► [GitHub Actions]
        │
        ▼ (Build, Test, Push Images to GHCR)
[Coolify Panel] ──► [Ubuntu VPS Nodes]
    ├──► [Next.js App Container]
    ├──► [Python Worker Containers]
    ├──► [Node.js Template Renderer Containers]  (Chromium pre-baked into image)
    └──► [Database]  (managed Supabase, external to the VPS fleet)
```

**[P1]** ships as a single VPS running docker-compose. **[P3]** moves to the multi-node Coolify/K8s topology shown above with per-pool auto-scaling.

---

# 43. Environment & Secrets

```
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
GROQ_API_KEY=gsk_your_groq_production_key
REDIS_HOST=127.0.0.1
DATABASE_ENCRYPTION_KEY=super-secure-32-byte-hex-key-here
PEXELS_API_KEY=your_pexels_key
CLOUDFLARE_WORKERS_AI_TOKEN=your_cf_token
YOUTUBE_OAUTH_CLIENT_ID=your_client_id
YOUTUBE_OAUTH_CLIENT_SECRET=your_client_secret
CHROMIUM_POOL_SIZE=8
TEMPLATE_OUTPUT_CODEC=vp9        # 'vp9' (default) | 'prores4444'
```

---

# 44. Roadmap

| Phase | Focus | Timeline |
|---|---|---|
| **P1 — Prove the Loop** | Core DB/Auth (single-user), agent chain (Research/Outline/Script+Direction), TTS, subtitle extraction, direct-to-WebM rendering, two styles only (stickman + documentary), FFmpeg render, download link. No dashboard, no multi-tenancy. | Months 1–2 |
| **P2 — Make It Usable** | Timeline/Template Studio UI, scene preview + approval gate, partial re-render, scene versioning, rig/template cloning, render caching, all four styles available. | Months 3–4 |
| **P3 — Make It a SaaS** | Multi-tenant workspaces/channels/RBAC, cost dashboard + caps, scheduled YouTube/Drive publishing, thumbnail/metadata generation, admin console, basic analytics. | Months 5–7 |
| **P4 — Enterprise & Scale** | Multi-language localization, avatar narration style, rig/template marketplace, audit logs, Kubernetes-grade autoscaling, physics-based secondary motion, viseme-accurate lip sync. | Months 8+ |

---

# 45. Estimated Costs

The v2.0 figure of ~\$0.22–0.24/video was an idealized, fully-warm-cache floor and did not include compute/infra amortization or retry overhead. This revision splits cost into two realistic scenarios.

## 45.1 Cold Start (first videos on a channel, empty cache, self-hosted mid-tier VPS + a rented GPU instance)

| Process Step | Primary Provider / Model | Expected Cost | Notes |
|---|---|---|---|
| Research & Script/Direction | Gemini 1.5 Flash (Free Tier) | \$0.00 | High context windows for zero cost. |
| Voiceover Synthesis | Kokoro-82M (Self-hosted) | \$0.00–0.05 | \$0 if VPS already running; small share of hourly GPU rental otherwise. |
| Subtitle Extraction | Faster-Whisper (Self-hosted) | \$0.00–0.03 | Share of GPU rental time. |
| Scene Preview Generation | Mixed (low-res renders) | \$0.02–0.05 | Cheap by design (§23), but not free. |
| Template Rendering (cold, no cache hits) | Remotion + Puppeteer (Self-hosted) | \$0.15–0.35 | Full-fidelity render for every scene; dominant cost driver on a cold cache. Documentary/typography styles render cheaper than character-rig scenes. |
| Stock Video B-Roll | Pexels / Pixabay APIs | \$0.00 | Open-source media library. |
| Image Generation | Cloudflare Workers AI SDXL | \$0.02–0.06 | ~\$0.001/image, more images on documentary-heavy scripts. |
| Video Rendering (compositing/encode) | Local/Rented GPU Instance | \$0.20–0.35 | Energy/hardware or hourly rental share; NVENC amortized. |
| Storage & Egress | Supabase Storage / S3 | \$0.02–0.05 | Warm-tier storage for 30 days. |
| Retry / Failure Buffer | — | ~10–15% of subtotal | Accounts for provider timeouts, template render retries, encode retries. |
| **Total Estimated Cost (Cold)** | | **~\$0.60–\$1.20** | Still comfortably within the original \$1–2 target, but not the near-\$0 figure quoted in v2.0. |

## 45.2 Steady State (established channel, warm `render_cache`, own hardware fully amortized)

| Process Step | Expected Cost | Notes |
|---|---|---|
| Research & Script/Direction | \$0.00 | Unchanged. |
| Voiceover, Subtitles | ~\$0.02 | Marginal compute only. |
| Template Rendering | ~\$0.00–0.05 | Most actions/templates are cache hits by this point. |
| B-roll / Images | ~\$0.02 | Mostly cache hits; occasional new footage. |
| Video Rendering / Storage | ~\$0.15–0.20 | Still the least-cacheable stage (final encode is per-video by nature). |
| **Total Estimated Cost (Steady State)** | **~\$0.25–\$0.40** | The v2.0 figure was directionally right for this regime, just mislabeled as the default. |

## 45.3 Notes

- Avatar narration (**[P4]**) is excluded from both tables above; budget \$0.50–\$3.00/video depending on provider and scene count when enabled.
- Kinetic typography is consistently the cheapest style to render (no Chromium-heavy skeletal animation, no image generation dependency), and documentary is the most storage-heavy (larger B-roll/image asset footprint per video).

---

# 46. Realistic Timing Estimate

The v2.0 target of "under 20 minutes" for a 20-minute video was optimistic. This section replaces it with a stage-by-stage estimate on **typical shared/mid-tier hardware** (a single 8-vCPU VPS with one consumer-class GPU, no dedicated render farm) — the environment a solo creator (§5.1) will actually run on before P3's auto-scaling exists.

| Stage | Estimated Time | Contention Factor |
|---|---|---|
| Research + Outline | 1–2 min | Network-bound (search/LLM latency) |
| Script + Direction | 1–3 min | LLM-bound; longer scripts take longer |
| Voiceover (all scenes) | 2–4 min | GPU-shared with Whisper/SDXL on the same box |
| Subtitle Extraction | 1–2 min | GPU-shared |
| Scene Preview (all scenes) | 1–3 min | CPU-bound, cheap by design |
| Scene Render (full quality, ~15–20 scenes) | 8–15 min | **Dominant cost.** Chromium render is CPU-bound and directly competes with any concurrent FFmpeg encode on the same box; documentary/typography scenes render faster than character-rig scenes. |
| Composition + Final Encode | 3–5 min | GPU-shared (NVENC) if available, else CPU-bound |
| Thumbnail + Metadata | 1 min | Lightweight |
| **Total** | **~20–35 minutes** | Depends heavily on style mix and whether GPU/CPU stages overlap or contend on a single box |

**Why the chain is contended, not just "slow":** Remotion/Chromium rendering, Whisper transcription, and SDXL image generation are all competing for the same limited CPU/GPU resources on a single-VPS **[P1]** deployment — there's no horizontal worker pool yet to parallelize them. §31/§40's queue-depth-based auto-scaling is what eventually closes this gap, but that's explicitly a **[P3]** capability, not something P1 should assume. On a properly scaled multi-worker fleet, wall-clock time for a single video can approach the original 15–20 minute target, because independent scenes render in parallel across multiple Chromium workers rather than sequentially on one box.

---

# 47. Bottlenecks & Future Improvements

- **Bottlenecks:** Third-party API limits (mitigated via local Ollama Llama 3 fallback), rendering latency on single-box P1 deployments (§46), headless-Chromium concurrency limits (mitigated via a pooled, pre-warmed browser context strategy).
- **Future Improvements:** Physics-driven secondary motion for character rigs, viseme-accurate lip-sync (moving beyond the amplitude-approximation in §19.1), smart video transitions using computer vision, secure voice cloning, and an analytics feedback loop correlating specific actions/templates/styles with audience retention to auto-tune future scene direction. **[P4]**

---

# 48. Open-Source Alternatives

```
ElevenLabs                ──► Replace with ──► Kokoro-82M / Coqui
Midjourney/DALL-E          ──► Replace with ──► Self-Hosted SDXL
HeyGen Avatar               ──► Replace with ──► SadTalker / MuseTalk
Vyond / Explee               ──► Replace with ──► Custom Remotion Character Rig Template
Adobe Character Animator      ──► Replace with ──► Custom keyframe JSON + Remotion compositions
Ken Burns-style doc tools       ──► Replace with ──► Custom Remotion Ken-Burns Template
Kinetic typography SaaS tools    ──► Replace with ──► Custom Remotion Kinetic Typography Template
```

---

# 49. Final Recommendations

- **Build P1 first, literally.** Two styles, one user, no dashboard, no auth beyond a login screen. The point of P1 is to find out whether "topic in, watchable automation video out" is good enough before spending months on the rest of this document.
- **Design the cache key before writing the renderer.** `(template_family, template_ref, params, timing_hash)` should exist in the schema on day one of P1's renderer work — retrofitting caching onto an already-built pipeline is significantly more expensive than building it in from the start.
- **Keep the action/template vocabulary small.** ~15–20 rig actions, a handful of Ken-Burns camera variants, a handful of typography motions. Every addition multiplies QA and cache-key surface area.
- **Ship the scene-preview gate before the full approval-gate system.** A single, cheap visual checkpoint (§23) captures most of the value of "review before you spend" without needing the full RBAC/notification machinery that belongs in P3.
- **Instrument cost per stage from the first deploy.** `cost_ledger_entries` should be populated from day one, even in P1 — it's far easier to catch a runaway provider bill early, and to validate the §45 cost model against reality, than to retrofit cost observability after tenants are already at scale.
- **Treat the renderer's style-agnosticism as the actual product moat.** The reason to build "one template engine, many styles" instead of a stickman-only tool isn't just user choice — it's that every future style (comic-panel, whiteboard-sketch, whatever comes next) becomes a template folder, not a rewrite.


# Appendix A – Architectural Recommendations & Future Enhancements

> **Note:** The following recommendations are intentionally placed in the appendix because they extend the platform beyond the initial MVP. These enhancements are designed to guide future iterations without affecting the implementation priorities defined in the main Engineering Design Document.

---

# A.1 Persistent YouTube Channel Identity System

## Objective

Introduce a **Persistent Channel Identity System** that enables every YouTube channel created within the platform to maintain a unique and recognizable brand across all generated videos.

Unlike traditional AI video generators where each video is generated independently, this platform treats a YouTube channel as a long-lived creative entity with its own identity, creative memory, assets, AI behavior, and production preferences.

Once a channel's first video is generated and approved, the resulting assets, styles, and creative decisions become the default identity for every subsequent video generated under that channel.

This ensures:

- Consistent branding
- Consistent storytelling
- Reduced repetitive configuration
- Faster content generation
- Long-term AI personalization
- Higher-quality content over time

---

# A.2 Channel-Centric Architecture

Rather than organizing content around individual projects, the platform should be designed around persistent channels.

```text
Workspace
│
├── Channel
│   ├── Identity
│   ├── Creative Memory
│   ├── Brand Assets
│   ├── Prompt Profiles
│   ├── Rendering Profiles
│   ├── Voice Profiles
│   ├── Thumbnail Profiles
│   └── Videos
│       └── Scenes
│
├── Channel
│   └── ...
│
└── Channel
    └── ...
```

Videos should belong to a **Channel**, not directly to a project.

This architecture enables a single user or organization to manage multiple independent YouTube channels while sharing the same rendering infrastructure.

---

# A.3 Channel Identity

Every channel maintains a persistent identity automatically applied during content generation.

## Brand Identity

- Channel Name
- Logo
- Banner
- Brand Colors
- Typography
- Watermark
- Intro Animation
- Outro Animation

---

## Visual Style

- Animation Template
- Character Rig
- Avatar
- Background Library
- Camera Style
- Transition Style
- Motion Presets
- Subtitle Style
- Visual Effects Presets

---

## Audio Style

- Default Voice
- Voice Provider
- Speaking Speed
- Narration Tone
- Background Music Style
- Intro Music
- Outro Music
- Sound Effect Library

---

## Thumbnail Identity

- Thumbnail Template
- Color Palette
- Font Style
- Text Placement Rules
- Logo Placement
- AI Thumbnail Prompt Template

---

## AI Creative Profile

Each channel stores a creative profile describing how the AI should generate content.

Example:

```yaml
Audience: Adults

Tone: Educational

Reading Level: Grade 9

Narration Style: Documentary

Humor: Low

Pacing: Medium

Hook Duration: 15 seconds

CTA Style: Soft

Transition Style: Slow Fade

Preferred Scene Length: 10–15 seconds

Visual Style: Minimal Documentary

Music Style: Epic Cinematic
```

Every LLM request automatically loads this profile before generating any content.

---

# A.4 Creative Memory

The platform should store not only reusable assets but also the AI's creative decisions.

Examples include:

- preferred script structure
- storytelling style
- explanation depth
- pacing
- visual rhythm
- narration style
- emotional tone
- transition frequency
- recurring visual motifs
- thumbnail composition
- preferred hooks
- preferred CTAs

Over time, the AI continuously learns the identity of each channel, producing increasingly consistent content without requiring additional prompting.

---

# A.5 First Video Initialization

The first generated video establishes the channel identity.

Workflow:

```text
Create Channel
        │
        ▼
Generate First Video
        │
        ▼
Generate Intro
        │
        ▼
Generate Outro
        │
        ▼
Generate Thumbnail
        │
        ▼
Generate Voice Profile
        │
        ▼
Generate Brand Assets
        │
        ▼
User Review & Approval
        │
        ▼
Save as Channel Identity
        │
        ▼
Future Videos Automatically Inherit Identity
```

The user may modify any generated asset before saving the final identity.

---

# A.6 Identity Inheritance

Every future video automatically inherits the channel identity.

```text
Channel
    │
    ▼
Identity
    │
    ▼
Video
    │
    ▼
Scene
```

Only scene-specific properties override inherited settings.

Everything else is automatically reused.

Examples include:

- intro
- outro
- logo
- narrator
- transitions
- colors
- camera movement
- fonts
- thumbnail style
- branding
- AI behavior

This dramatically reduces repetitive configuration while maintaining channel consistency.

---

# A.7 Multi-Channel Support

The platform should support multiple independent YouTube channel identities.

Example:

```text
Workspace

├── HistoryHub

├── Finance Explained

├── Space Daily

├── AI Academy

├── Anime Origins

└── Programming Central
```

Each channel maintains completely separate:

- branding
- assets
- prompts
- voice profiles
- AI behavior
- thumbnails
- intros
- outros
- rendering settings
- publishing preferences
- creative memory

All channels share the same underlying infrastructure while remaining logically isolated.

---

# A.8 Recommended Database Additions

```text
channels

channel_identity

channel_assets

channel_branding

channel_prompt_profiles

channel_voice_profiles

channel_thumbnail_profiles

channel_music_profiles

channel_transition_profiles

channel_render_profiles

channel_ai_memory

channel_brand_rules

channel_intro_assets

channel_outro_assets
```

Each generated video should simply reference:

```text
channel_id
```

instead of duplicating configuration.

---

# A.9 AI Prompt Integration

Every LLM request should automatically prepend the channel profile.

Example:

```text
SYSTEM

You are generating content for the YouTube channel "HistoryHub".

Follow these rules:

• Educational documentary style
• Professional narration
• Medium pacing
• Grade 9 reading level
• Blue and gold branding
• Slow cinematic transitions
• Epic orchestral background music
• Soft call-to-action
• Maintain consistency with previous uploads
```

This enables the AI to consistently preserve the channel's identity across every generated video.

---

# A.10 Continuous Learning

As additional videos are produced, the platform may optionally analyze historical performance to improve future generations.

Potential optimization signals include:

- audience retention
- average watch duration
- click-through rate (CTR)
- thumbnail performance
- title performance
- scene drop-off points
- engagement metrics
- publishing schedule
- viewer demographics

These metrics may be incorporated into future prompt generation, rendering decisions, and content planning.

---

# A.11 Long-Term Vision

The long-term objective is to evolve the platform from an AI-powered video generator into a **persistent AI production studio** capable of managing multiple independent YouTube brands.

Each channel becomes a self-contained creative entity with its own:

- brand identity
- reusable assets
- creative memory
- AI behavior
- narration style
- rendering preferences
- thumbnail language
- publishing workflow
- production history

As the number of generated videos grows, the AI requires progressively less user input because it already understands how each channel should think, write, animate, narrate, and present content.

---

# A.12 Future AI Brand Evolution

Future versions of the platform may enable channels to evolve automatically while preserving their established identity.

Potential capabilities include:

- Automatic brand consistency validation
- AI-generated branding improvements
- Adaptive thumbnail optimization
- Voice evolution while maintaining familiarity
- Automatic intro/outro refinement
- Prompt optimization based on historical performance
- Style drift detection
- Brand consistency scoring
- AI-assisted channel rebranding
- Cross-video knowledge retention

These capabilities transform the platform into an intelligent creative partner rather than a simple content generation tool.

---

# Conclusion

This architecture establishes the foundation for a scalable, multi-channel AI content production platform.

By separating **Channel Identity** from **individual video generation**, the system enables:

- Persistent branding
- Reusable creative assets
- AI-driven stylistic consistency
- Long-term creative memory
- Automatic identity inheritance
- Multi-channel management
- Continuous learning
- Future AI optimization

This design transforms the application from an AI video generator into a persistent **AI-powered YouTube Production Studio**, where each channel develops its own recognizable identity while leveraging a shared, modular, and scalable generation pipeline.