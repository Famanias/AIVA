# Walkthrough — AIVA Web Application Redesign

We have implemented the full visual, layout, navigation, and UI component redesign for the AIVA web application (`apps/web/`) in accordance with [`REDESIGN_SPEC.md`](file:///d:/repos/AIVA/apps/web/REDESIGN_SPEC.md).

---

## Key Changes Implemented

### 1. Design System & Typography Tokens
- **Design Tokens (`src/app/tokens.css`)**: Defined CSS custom properties and Tailwind v4 `@theme` mappings for:
  - **Black Scale**: `#1a1a1a` to `#000000` for surface elevations and background layers.
  - **Red Accent Scale**: `#fff0f0` to `#990000` with `#ff0000` primary brand red.
  - **Glassmorphism & Elevation**: `rgba(20, 20, 20, 0.6)` backdrop blur, borders, and red glow shadows.
  - **Motion & Spacing**: Standardized duration and cubic-bezier easing tokens with global `prefers-reduced-motion` support.
- **Font Configuration (`src/app/fonts.ts`)**: Integrated `next/font/google` for:
  - **Syne**: Headings, branding, stat counters.
  - **Inter**: Body text, form controls, UI tables.
  - **JetBrains Mono**: Code identifiers, keys, and IDs.
- **Global Styles (`src/app/globals.css`)**: Configured skip-to-content links, `*:focus-visible` accessibility rings, custom scrollbars, and selection highlights.

---

### 2. Radix UI Primitives Suite (`src/components/ui/`)
Created accessible primitives following WCAG AA standards:
- [`button.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/button.tsx): CVA variants (`primary`, `secondary`, `ghost`, `destructive`, `outline`) with size options and Radix `Slot` delegation.
- [`card.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/card.tsx): Glassmorphic containers (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
- [`input.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/input.tsx): Form inputs & textareas with labels, validation states, and assistive descriptions.
- [`select.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/select.tsx): Radix Select suite with custom triggers, viewports, and item indicators.
- [`modal.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/modal.tsx): Radix Dialog modal overlays with animations.
- [`toast.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/toast.tsx): Toast notifications and `Toaster` provider.
- [`tooltip.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/tooltip.tsx), [`dropdown.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/dropdown.tsx), [`tabs.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/tabs.tsx), [`table.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/table.tsx), [`progress.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/progress.tsx), [`avatar.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/avatar.tsx), [`separator.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/separator.tsx), [`skeleton.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/skeleton.tsx), [`empty-state.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/empty-state.tsx), [`label.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/label.tsx), [`checkbox.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/checkbox.tsx), [`switch.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/switch.tsx), [`alert.tsx`](file:///d:/repos/AIVA/apps/web/src/components/ui/alert.tsx).

---

### 3. Application Shell & Navigation
- [`header.tsx`](file:///d:/repos/AIVA/apps/web/src/components/layout/header.tsx): Responsive navigation header featuring brand logo avatar, active link indicators, user menu dropdown, and mobile navigation drawer.
- [`footer.tsx`](file:///d:/repos/AIVA/apps/web/src/components/layout/footer.tsx): Clean copyright footer and documentation links.
- [`layout.tsx`](file:///d:/repos/AIVA/apps/web/src/app/layout.tsx): App-wide root shell incorporating font variables, dark color scheme, skip link, Header, Footer, `ModalProvider`, and `Toaster`.
- [`(dashboard)/layout.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/layout.tsx): Container wrapper for dashboard sub-pages.

---

### 4. Page Redesigns & Dashboard Views
- **Home Dashboard ([`src/app/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/page.tsx))**:
  - Top header with "Create Video / Browse Projects" actions.
  - Telemetry stats banner ([`OperationsSummaryHeader.tsx`](file:///d:/repos/AIVA/apps/web/src/components/dashboard/OperationsSummaryHeader.tsx)) tracking active, paused, completed, and failed jobs.
  - 2-column layout: Brief creation console ([`initialize-pipeline.tsx`](file:///d:/repos/AIVA/apps/web/src/components/dashboard/initialize-pipeline.tsx)) + Live Queue controls ([`operations-console.tsx`](file:///d:/repos/AIVA/apps/web/src/components/dashboard/operations-console.tsx)).
- **Login / Authentication ([`src/app/login/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/login/page.tsx))**:
  - Syne typography brand card with sign-in and account registration toggle.
  - Client auth hook integration ([`src/lib/auth/client.ts`](file:///d:/repos/AIVA/apps/web/src/lib/auth/client.ts)) with `/api/v1/auth/me` and `/api/v1/auth/logout`.
- **System Settings ([`src/app/(dashboard)/settings/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/settings/page.tsx))**:
  - Tabbed interface: **Providers**, **LLM Config** (with quick-select endpoint presets and dynamic model discovery), **Ollama** (offline local inference connection tester), and **API Keys** (AES-256 encrypted fields).
- **Projects Catalog ([`src/app/(dashboard)/projects/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/projects/page.tsx))**:
  - Responsive project cards with thumbnails, status badges, dropdown action menus (Details, Timeline, Delete), and empty-state handler.
- **Project Overview ([`src/app/(dashboard)/projects/[id]/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/projects/%5Bid%5D/page.tsx))**:
  - Video composition player preview, status indicator, asset downloads (MP4, SRT subtitles, script checkpoint JSON), and failure recovery banner with one-click pipeline resumption.
- **Timeline Studio ([`src/app/(dashboard)/projects/[id]/timeline/page.tsx`](file:///d:/repos/AIVA/apps/web/src/app/%28dashboard%29/projects/%5Bid%5D/timeline/page.tsx))**:
  - Multitrack scene breakdown with inline narration script and visual prompt editors, render status tags, and per-scene re-render triggers.

---

## Verification & Build Results

### Automated Typecheck & Build
Executed `pnpm --filter web build` with Next.js Turbopack:
```
▲ Next.js 16.2.10 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 44s
  Running TypeScript ...
✓ Generating static pages (18/18)
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/v1/auth/login
├ ƒ /api/v1/auth/logout
├ ƒ /api/v1/auth/me
├ ƒ /api/v1/jobs
├ ƒ /api/v1/projects
├ ƒ /api/v1/settings
├ ○ /login
├ ○ /projects
├ ƒ /projects/[id]
├ ƒ /projects/[id]/timeline
└ ○ /settings
```
- **TypeScript**: Passed with 0 errors.
- **Static & Dynamic Pages**: All 18 App Router routes bundled and optimized successfully.
