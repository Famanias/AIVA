# Domain Documentation Configuration

- **Layout**: Single-context
- **Primary Context File**: `CONTEXT.md`
- **Architecture & Decisions**: `docs/EDD.md`, `ADR.md` (or `docs/adr/`)

## Agent Rules for Reading Domain Docs

1. **Before starting work**:
   - Read `CONTEXT.md` to understand current project state, active phase goals, and system overview.
   - Read `AGENTS.md` and `.agents/rules/rules.md` for engineering constraints and decision priorities.
   - Consult `docs/EDD.md` for architectural design details.

2. **Single-Context Rules**:
   - All domain knowledge, features, and system context live in `CONTEXT.md` at the repo root.
   - Architectural decision records are stored in `ADR.md` or `docs/adr/`.
   - Keep `CONTEXT.md` updated when major feature context or status changes.
