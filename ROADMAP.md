# ROADMAP.md

> **Purpose**
>
> This document describes the major development phases and long-term objectives.
>
> It does not contain sprint tasks or implementation details.
>
> For the active implementation backlog, see [TASKS.md](TASKS.md).

---

# Phase Overview

| Phase | Name | Objective | Timeline |
|---|---|---|---|
| P0 | Repository Initialization | Documentation, architecture, project setup | ✅ Complete |
| P1 | Prove the Loop (Short-Form Engine) | Short-form production engine (vertical, fast rendering) | ✅ Complete |
| P2 | Publishing & Automation | Publishing, scheduling, analytics, automation | Months 3–4 |
| P3 | Long-Form Generation | Multi-tenancy, long-form documentaries | Months 5–7 |
| P4 | Multi-Agent Production Studio | Localization, custom agent flows, studio scale | Months 8+ |

---

# P1 — Prove the Loop (Short-Form Production Engine)

**Objective:** Validate that the core pipeline works end-to-end, optimized for short-form, high-retention vertical videos (e.g., YouTube Shorts).

**Scope:**

- Single user, single workspace
- Two video styles: stickman animation + documentary
- Content Strategy: Topic → Hook → Retention Outline → Script → Scenes
- ShortForm GenerationProfile (e.g. 60 seconds, 9:16 aspect ratio)
- Single VPS deployment via docker-compose
- Basic cost logging
- Provider abstraction from day one

**Explicitly excluded:** Multi-tenancy, long-form generation, publishing automation.

**Success criteria:** A user submits a topic and receives a downloadable, high-retention short-form video.

---

# P2 — Publishing & Automation

**Objective:** Add scheduling, automation, publishing, and creative control tools to make it a fully usable engine.

**Scope:**

- Interactive Timeline Studio UI
- Scene preview before full render
- Approval gate (scene preview)
- Partial scene re-render
- Rig/template cloning and re-skinning
- Scene versioning
- Render caching
- All four video styles available (add kinetic typography)
- Cost estimation before render
- Media asset manager
- Advanced Queue Controls (Single, Bulk, Pipeline Cancellation) [✅ Early Delivered]

**Success criteria:** A user can review, edit, and selectively re-render scenes before committing to a full video.

---

# P3 — Long-Form Generation

**Objective:** Enable multi-tenant SaaS capabilities, multi-channel operation, and introduce long-form documentary generation.

**Scope:**

- Multi-tenant workspaces and channels
- RBAC (Owner/Editor/Viewer)
- Cost dashboard with per-workspace caps
- LongForm ContentStrategy (Topic → Research → Outline → Chapters → Script)
- Horizontal auto-scaling of workers

**Success criteria:** The platform supports both short-form and long-form workflows concurrently, managed across multiple tenants.

---

# P4 — Multi-Agent Production Studio

**Objective:** Enterprise features, multi-agent workflows, and advanced localization.

**Scope:**

- Multi-language localization pipeline
- Avatar narration style
- Custom rig/template marketplace
- Audit logs and compliance
- Kubernetes-grade autoscaling
- Physics-based secondary motion
- Viseme-accurate lip sync
- Analytics feedback loop

**Success criteria:** Enterprise customers can use the platform for brand-safe, multi-language content production at scale.

---

# Guiding Principle

Each phase must be fully validated before the next phase begins.

Do not build P2 features during P1.

Reference: [docs/EDD.md §1.2, §49](docs/EDD.md)
