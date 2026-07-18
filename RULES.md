# RULES.md

> **Purpose**
>
> This document defines the non-negotiable engineering rules for this repository.
>
> These rules are mandatory for both human contributors and AI agents.
>
> The Engineering Design Document (`docs/EDD.md`) remains the architectural source of truth. This document defines the implementation constraints that must always be respected.

---

# Core Philosophy

The primary objective of this project is to deliver a working MVP as quickly as possible while preserving a clean, modular architecture that can evolve into the complete platform described in the EDD.

Every engineering decision should balance:

* Simplicity
* Maintainability
* Scalability
* Reliability
* Future compatibility

When in doubt, optimize for shipping a working MVP rather than implementing future features prematurely.

---

# Rule 1 — Respect the Architecture

The Engineering Design Document (`docs/EDD.md`) is the architectural source of truth.

Do not redesign or replace existing architecture without a compelling technical reason.

If implementation reveals a weakness in the architecture, propose the change before implementing it.

---

# Rule 2 — Build Only for the Current Phase

Implement only the functionality required for the current roadmap phase.

Do not build:

* future enterprise features
* speculative abstractions
* premature optimizations
* "nice-to-have" functionality

Every feature should directly support the current MVP milestone.

---

# Rule 3 — Decoupling & Modularity

Build systems as independent modules with clear responsibilities.

Always:

* favor composition over inheritance
* depend on abstractions rather than implementations
* keep functions and services focused on a single responsibility
* communicate through well-defined interfaces
* avoid hidden dependencies and duplicated business logic

Every module should be replaceable with minimal impact on the rest of the system.

---

# Rule 4 — Business Logic Lives Outside the UI

Frontend components are responsible for presentation and user interaction only.

Business logic belongs in services, backend modules, workflows, or domain layers.

The UI should never become the source of business rules.

---

# Rule 5 — Abstract External Providers

Business logic must never depend directly on external providers.

This includes:

* AI providers
* LLM APIs
* OCR providers
* rendering engines
* storage providers
* payment providers
* notification services

Provider-specific code belongs exclusively inside provider implementations.

All providers must remain interchangeable.

---

# Rule 6 — Keep the Rendering Engine Template-Agnostic

The rendering engine must never assume:

* stickmen
* documentaries
* avatars
* talking heads
* shorts
* long-form videos
* any specific visual style

Rendering should always be driven by reusable templates.

Content generation and rendering must remain independent systems.

---

# Rule 7 — Zero Hardcoding

Never hardcode:

* API keys
* secrets
* URLs
* provider identifiers
* model names
* prompt templates
* rendering templates
* business rules
* configuration values

Configuration, prompts, and templates must be centralized and injected into the application.

---

# Rule 8 — APIs Must Be Stable and Validated

Every API should:

* validate all inputs
* return predictable responses
* use appropriate HTTP status codes
* fail clearly
* preserve backward compatibility whenever practical

Never trust:

* user input
* uploaded files
* webhook payloads
* AI-generated output
* external API responses

---

# Rule 9 — Long-Running Work Must Be Resumable

Every long-running workflow should be designed for recovery.

Examples include:

* research
* script generation
* asset generation
* rendering
* uploads

Avoid workflows that require restarting the entire pipeline after a partial failure.

Design for idempotency whenever possible.

---

# Rule 10 — Simplicity First

Choose the simplest explicit solution that satisfies the current requirements.

Readable code is preferred over clever code.

Optimize only proven bottlenecks.

Complexity must always justify itself.

---

# Rule 11 — Documentation Is Part of the System

Documentation must evolve with the implementation.

Whenever implementation changes:

* architecture
* workflows
* project status
* assumptions
* security model
* implementation strategy

determine whether the repository documentation should also be updated.

Documentation should never drift away from the codebase.

---

# Rule 12 — Dependencies Must Justify Their Existence

Before introducing a dependency, determine:

* whether the existing stack already solves the problem
* whether the dependency is actively maintained
* whether the long-term maintenance cost is justified

Avoid unnecessary dependencies.

---

# Rule 13 — Human Approval for Architectural Changes

No AI agent may significantly modify the project's architecture without explicit user approval.

When an architectural change is recommended:

1. Explain the problem.
2. Explain the proposed solution.
3. Explain the trade-offs.
4. Explain the expected impact.
5. Wait for approval before implementing.

The AI may recommend architectural improvements, but must never implement them autonomously.

---

# Definition of Success

A successful implementation:

* follows the EDD
* respects these rules
* satisfies the current milestone
* preserves modularity
* minimizes technical debt
* remains understandable by future contributors
* keeps the project moving toward the long-term vision

Every line of code should make the system easier—not harder—to extend.