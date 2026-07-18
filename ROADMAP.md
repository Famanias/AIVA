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
| P1 | Prove the Loop | Single user, two styles, topic → video → download | ✅ Complete |
| P2 | Make It Usable | Timeline Studio, scene preview, partial re-render, all 4 styles | Months 3–4 |
| P3 | Make It a SaaS | Multi-tenancy, channels, RBAC, cost dashboard, publishing | Months 5–7 |
| P4 | Enterprise & Scale | Localization, avatar style, marketplace, audit logs, K8s | Months 8+ |

---

# P1 — Prove the Loop

**Objective:** Validate that "topic in, watchable automation video out" works.

**Scope:**

- Single user, single workspace
- Two video styles: stickman animation + documentary
- Core pipeline: topic → research → script/direction → voiceover → render → download
- No dashboard beyond a status page and topic-submission form
- Single VPS deployment via docker-compose
- Basic cost logging (cost_ledger_entries populated)
- Provider abstraction from day one

**Explicitly excluded:** Multi-tenancy, RBAC, approval gates, channel scheduling, avatar style, kinetic typography, rig marketplace, analytics, cost dashboard.

**Success criteria:** A user submits a topic and receives a downloadable, watchable MP4 in their chosen style.

---

# P2 — Make It Usable

**Objective:** Add the creative control and quality feedback loop that turns "it works" into "I'd actually use this."

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

**Success criteria:** A user can review, edit, and selectively re-render scenes before committing to a full video.

---

# P3 — Make It a SaaS

**Objective:** Enable multi-user, multi-channel operation with billing, publishing, and admin tooling.

**Scope:**

- Multi-tenant workspaces and channels
- RBAC (Owner/Editor/Viewer)
- Cost dashboard with per-workspace caps
- Scheduled YouTube/Drive publishing
- Thumbnail and metadata generation
- Admin console (queue health, DLQ, tenant management)
- Full approval workflow with notifications
- Horizontal auto-scaling of workers

**Success criteria:** Multiple users can independently operate channels with cost visibility and automated publishing.

---

# P4 — Enterprise & Scale

**Objective:** Enterprise features, advanced rendering, and marketplace.

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
