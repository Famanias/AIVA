# AGENTS.md

> **Purpose**
>
> This document defines how AI coding agents should behave while working on this repository.
>
> It is **not** an architecture document.
> It is **not** a project specification.
>
> The Engineering Design Document (`docs/EDD.md`) remains the source of truth for the system architecture.
>
> This document defines *how work should be performed*.

---

# IMPORTANT!
When in doubt, optimize for shipping a working MVP rather than implementing future features prematurely.

# Project Mission

The objective of this project is to build an AI-powered YouTube content production platform capable of automatically researching, scripting, generating, rendering, and publishing videos.

The long-term vision includes:

- AI research
- script generation
- scene generation
- video rendering
- thumbnail generation
- publishing
- multi-channel identity
- reusable assets
- AI creative memory
- scalable SaaS architecture

However...

## The immediate objective is NOT to build the complete platform.

The immediate objective is to build a **working MVP (Version 1)** that validates the product as quickly as possible.

Every engineering decision should support this goal.

---

# Generation Assumptions (CRITICAL)

AIVA is a configurable AI video generation platform.

**Unless explicitly instructed otherwise, assume the active GenerationProfile is the Phase 1 Short-Form profile.**

This means you should assume videos are short (30-120s), vertical (9:16), and use high-retention pacing (hook in first 3 seconds, fast narrative beats).

However, **do not hardcode these assumptions into the architecture**. The architecture must remain media-length agnostic so it can support long-form generation in future phases.

---

# Documentation Hierarchy

When multiple documents exist, always follow this order of authority.

1. AGENTS.md
2. RULES.md
3. CONTEXT.md
4. TASKS.md
5. MEMORY.md
6. ROADMAP.md
7. SECURITY.md
8. docs/EDD.md

If two documents appear to conflict:

- Never guess.
- Explain the conflict.
- Request clarification if necessary.

---

# Engineering Philosophy

This project values:

- Simplicity
- Maintainability
- Scalability
- Modularity
- Readability
- Testability
- Long-term evolution

Never optimize prematurely.

Never introduce complexity unless it solves a real problem.

The MVP should remain intentionally small.

---

# MVP Philosophy

Version 1 exists only to validate the product.

When deciding between:

Option A
- Faster
- Simpler
- Easier

and

Option B
- More scalable
- More configurable
- More enterprise-ready

Prefer **Option A** if it does not create significant technical debt.

---

# Architecture Principles

Always preserve the architecture defined in the EDD.

Do not redesign existing systems unless there is a strong technical reason.

Important principles include:

- Provider abstraction
- Modular architecture
- Scene-based generation
- Queue-based processing
- Stateless APIs
- Resumable workflows
- Clear module boundaries

---

# Coding Principles

Always write code that is:

- readable
- maintainable
- predictable
- type-safe
- modular

Avoid clever solutions.

Favor explicit code over magic.

---

# File Organization

Keep responsibilities separated.

Example:

- UI
- API
- Services
- Providers
- Workers
- Database
- Shared Types

Business logic should never live inside UI components.

---

# AI Development Workflow

Before implementing any feature:

1. Read CONTEXT.md
2. Read TASKS.md
3. Review MEMORY.md
4. If architecture is affected, consult docs/EDD.md
5. Plan implementation
6. Explain the approach
7. Implement
8. Verify functionality
9. Update documentation if necessary

Never skip planning.

---

# Decision Making

When making technical decisions:

1. Prefer existing architecture.
2. Prefer reuse over duplication.
3. Prefer composition over inheritance.
4. Prefer interfaces over concrete implementations.
5. Prefer configuration over hardcoding.

---

# AI Provider Philosophy

All AI providers must remain abstracted.

Never tightly couple business logic to:

- OpenAI
- Groq
- OpenRouter
- Gemini
- Anthropic
- Ollama

Providers should be interchangeable.

---

# Rendering Philosophy

Rendering should remain template-based.

Never tightly couple rendering to:

- stickmen
- avatars
- documentaries
- any specific animation style

The renderer should support future templates with minimal changes.

---

# Database Philosophy

Database changes should be:

- normalized
- versioned when appropriate
- backward compatible whenever possible

Avoid unnecessary denormalization during MVP.

---

# API Philosophy

APIs should be:

- RESTful
- validated
- typed
- documented
- predictable

Never expose internal implementation details.

---

# Error Handling

Never silently ignore errors.

Always:

- validate inputs
- return meaningful messages
- log failures
- preserve debugging information

---

# Logging

Prefer structured logging.

Logs should answer:

- What happened?
- Why?
- Which component?
- Which request?
- What failed?

---

# Performance

Do not optimize everything.

Only optimize proven bottlenecks.

Correctness comes before performance.

Maintainability comes before micro-optimizations.

---

# Security

Always assume:

- user input is malicious
- external APIs can fail
- network requests can timeout

Validate everything.

Never trust client input.

Never expose secrets.

---

# Documentation

Whenever implementation changes architecture:

Recommend updates to:

- docs/EDD.md
- MEMORY.md
- CONTEXT.md

Do not allow documentation to drift away from implementation.

---

# Scope Control

One of the biggest risks of this project is feature creep.

When implementing:

Ask:

> "Is this required for Version 1?"

If not,

recommend postponing it.

---

# Communication Style

When proposing changes:

Explain:

- Why
- Benefits
- Risks
- Alternatives

Do not immediately generate code if architecture discussions are still ongoing.

---

# Definition of Done

A feature is considered complete only when:

- Requirements are satisfied.
- Code compiles.
- Types are correct.
- No obvious bugs exist.
- Existing functionality is not broken.
- Documentation remains accurate.
- Future architecture compatibility is preserved.

---

# Things to Avoid

Never:

- rewrite the architecture without justification
- duplicate business logic
- hardcode provider-specific behavior
- tightly couple modules
- over-engineer the MVP
- introduce unnecessary dependencies
- ignore existing documentation

---

# Session Workflow

At the beginning of every session:

1. Read AGENTS.md
2. Read CONTEXT.md
3. Read TASKS.md
4. Review MEMORY.md
5. Make sure to adhere to the SECURITY.md and RULES.md
6. Consult docs/EDD.md if necessary

Before writing code:

- Understand the objective.
- Confirm the implementation plan.
- Identify affected modules.
- Consider future compatibility.

After implementation:

- Suggest updates to TASKS.md.
- Suggest updates to MEMORY.md if new knowledge was discovered.
- Suggest updates to CONTEXT.md if project status changed.
- Suggest updates to docs/EDD.md if architecture evolved.

---

# Final Principle

This project is intended to evolve over many iterations.

Every implementation should balance:

- MVP simplicity
- long-term maintainability
- future scalability

Build only what is necessary today while preserving the ability to build everything planned tomorrow.

## Documentation Maintenance

Documentation is part of the codebase.

Whenever implementation changes project status, architecture, security, or development progress, determine whether the following documents should be updated:

- CONTEXT.md
- TASKS.md
- MEMORY.md
- ADR.md
- ROADMAP.md (only for major roadmap changes)
- SECURITY.md (only if security architecture changes)
- README.md (only if setup or project structure changes)

Do not update documentation unnecessarily.

Keep documentation concise and synchronized with the implementation.

If a document becomes outdated, recommend the required updates before completing the task.