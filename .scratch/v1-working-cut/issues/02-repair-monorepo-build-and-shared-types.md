# 02 Repair Monorepo Build and Shared Types Packaging

Type: task
Status: resolved
Blocked by: none

## Question

How do we configure `@aiva/shared-types` build scripts, `package.json` entry points, and workspace references so that a clean git clone builds successfully in Docker (`apps/web/Dockerfile`) and runs `pnpm dev` without requiring untracked manual compilation?

## Context

`packages/shared-types/package.json` sets `main`/`types` to `./dist/index.js`, but `dist/` is gitignored and there is no `prepare` script. Clean clones fail with `Cannot find module '@aiva/shared-types'`.

## Acceptance Criteria

1. `packages/shared-types` includes a `build` script (`tsc`) and a `prepare` or build pipeline hook.
2. Root `pnpm-workspace.yaml` and `package.json` properly build `@aiva/shared-types` before dependent apps build.
3. `apps/web/Dockerfile` and local `pnpm dev` compile and run on a clean checkout.

## Answer

Resolved:
- Added `"prepare": "tsc"` hook to `packages/shared-types/package.json` so that `pnpm install` builds types automatically.
- Updated `apps/web/Dockerfile` and `apps/template-renderer/Dockerfile` to explicitly build `@aiva/shared-types` during container compilation.
- Verified end-to-end `turbo build` across all 5 workspace packages with 0 errors.

