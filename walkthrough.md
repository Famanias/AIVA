# Walkthrough — Milestone 2: Repair Monorepo Build & Shared Types Packaging

## Summary of Changes

Milestone 2 resolves **Ticket 02** by ensuring `@aiva/shared-types` compiles cleanly on fresh checkouts and inside container builds:
- **`packages/shared-types/package.json`**: Added `"prepare": "tsc"` so that any `pnpm install` invocation automatically generates `dist/index.js` and `dist/index.d.ts`.
- **`apps/web/Dockerfile`**: Added explicit build step `RUN pnpm --filter @aiva/shared-types build` before `RUN pnpm --filter web build`.
- **`apps/template-renderer/Dockerfile`**: Added explicit build step `RUN pnpm --filter @aiva/shared-types build` before `RUN pnpm --filter aiva-template-renderer build`.
- **Environment Configuration**: Reconciled `.env` `DATABASE_URL` to point to port `5432` (`postgresql://postgres:postgres@127.0.0.1:5432/aiva`).

---

## Files Changed

| File | Status | Description |
|---|---|---|
| [`packages/shared-types/package.json`](file:///d:/repos/AIVA/packages/shared-types/package.json) | Modified | Added `prepare` hook for automated compilation on install |
| [`apps/web/Dockerfile`](file:///d:/repos/AIVA/apps/web/Dockerfile) | Modified | Added explicit `shared-types` build step |
| [`apps/template-renderer/Dockerfile`](file:///d:/repos/AIVA/apps/template-renderer/Dockerfile) | Modified | Added explicit `shared-types` build step |
| [`.env`](file:///d:/repos/AIVA/.env) | Modified | Reconciled `DATABASE_URL` port to 5432 |
| [`.scratch/v1-working-cut/issues/02-repair-monorepo-build-and-shared-types.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/issues/02-repair-monorepo-build-and-shared-types.md) | Modified | Marked Ticket 02 as resolved |
| [`.scratch/v1-working-cut/map.md`](file:///d:/repos/AIVA/.scratch/v1-working-cut/map.md) | Modified | Updated Decisions-so-far index |

---

## Automated Verification Results

1. **Clean Dist & Monorepo Build**:
   ```bash
   pnpm --filter @aiva/shared-types clean
   pnpm build
   ```
   *Result:* Exit 0 — Turbo built all 4 workspace packages (`@aiva/shared-types`, `aiva-template-renderer`, `@aiva/prompt-library`, `web` Next.js Turbopack) successfully.

---

## Manual QA Instructions

To manually verify Milestone 2:

1. **Clean Shared-Types Build Output**:
   ```powershell
   pnpm --filter @aiva/shared-types clean
   ```
2. **Run Full Monorepo Build**:
   ```powershell
   pnpm build
   ```
3. **Verify Dist Artifacts**:
   Check that `packages/shared-types/dist/index.js` and `packages/shared-types/dist/index.d.ts` exist.

### Expected Results
- `pnpm build` finishes with `Tasks: 4 successful, 4 total` and exit code 0.
