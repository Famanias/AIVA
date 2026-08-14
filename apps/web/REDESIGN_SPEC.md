# Instructions for the Implementing Agent

You are implementing a full redesign of the AIVA web app. You do **not** know this codebase — this file (plus the inline code in it) is your only reference. Read the whole spec below first, then build.

## What you're building

A complete visual + layout + navigation + content redesign of the Next.js web app at `apps/web/` (Next.js 16 App Router, React 19, **Tailwind v4 CSS-first**, TypeScript). New look: **dark-only, black/red theme**, Syne (display) + Inter (body) fonts, glassmorphism surfaces, Radix-based UI primitives.

## How to work

1. **Read everything below first.** The spec is ordered the way you should build: tokens → fonts → utils → primitives → shell/header/footer → pages → dashboard components → feature flag → testing.
2. **Follow the Implementation Order (Section 6) strictly.** Do not jump ahead — primitives and tokens must exist before pages consume them.
3. **Tailwind v4 note:** there is **no `tailwind.config.*` file and no JS config**. All design tokens live in CSS via an `@theme` block (see `tokens.css` in Section 2.3) + `:root` custom properties (Section 1). Do **not** create a JS config; add new tokens to `apps/web/src/app/tokens.css`/`globals.css`. Utilities like `bg-bg-page`, `text-text-primary`, `shadow-glow` are generated from those tokens.
4. **No new UI primitive libraries beyond what's listed** in Section 11 (`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`). Install them with `pnpm add` in `apps/web`. Don't reach for shadcn/MUI/etc.
5. **Create a `src/` alias** if not present: the spec imports use `@/components/...` and `@/lib/...`. Check `apps/web/tsconfig.json` `paths`; add `"@/*": ["./src/*"]` if missing.
6. **Preserve existing behavior.** The data-fetching logic in `page.tsx`, `settings/page.tsx`, and the `providers/` stays the same — you are restyling and restructuring markup, not changing API calls or state logic. The spec marks stubbed handlers/types (e.g. `defaultForm`, `OllamaStatus`, `ToastState`); derive their shapes from the current `settings/page.tsx` and `types/telemetry.ts`.
7. **Accessibility is a hard requirement** (Section 8): `focus-visible` rings on every interactive element, skip link, `aria-live` for async updates, labels on all inputs, `prefers-reduced-motion` respected. The old code violates these — fix them as you touch each file.
8. **Feature flag:** gate the new routes behind `NEXT_PUBLIC_NEW_DESIGN`. Keep old pages reachable at `/legacy/*` until cleanup (Section 10).
9. **Use `next/font/google`** for Syne/Inter/JetBrains Mono (Section 2.1) — do not add `<link>` font tags or `@import` webfonts in CSS.

## Files you'll touch (all under `apps/web/`)

- `src/app/tokens.css` *(new)*, `src/app/globals.css` *(edit)*, `src/app/fonts.ts` *(new)*, `src/app/layout.tsx` *(edit)*
- `src/app/(dashboard)/layout.tsx` *(new shell)*
- `src/components/layout/header.tsx` *(new)*, `src/components/layout/footer.tsx` *(new)*
- `src/components/ui/*` *(new — ~20 primitives)*
- `src/lib/utils.ts` *(new, `cn()`)*, `src/lib/auth/client.ts` *(edit, `useAuth`)*
- Pages: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/projects/page.tsx` *(new)*, `src/app/(dashboard)/projects/[id]/page.tsx`, `src/app/(dashboard)/projects/[id]/timeline/page.tsx`
- `src/components/dashboard/*` *(edit — adopt new primitives)*

When in doubt, match the style/tokens shown in the inline code below rather than inventing new patterns.

---

# AIVA — Black/Red Redesign Implementation Spec

> **Scope**: Full visual + layout + navigation + content redesign (Q1=D). Dark-only, black/red theme, Syne+Inter, glassmorphism, Radix primitives, all-at-once PR behind feature flag.

---

## 1. Brand Palette & Design Tokens

### 1.1 Color Scale (Tailwind v4 `@theme` + CSS custom properties)

**Black scale** (page bg → elevated surfaces):

```css
--color-black-50: #1a1a1a;  /* subtle elevated */
--color-black-100: #141414; /* card bg */
--color-black-200: #0d0d0d; /* page bg alt */
--color-black-300: #0a0a0a; /* MAIN page bg */
--color-black-400: #060606; /* near-black */
--color-black-500: #030303; /* almost pure */
--color-black-600: #000000; /* pure black */
```

**Red accent scale**:

```css
--color-red-50: #fff0f0;  /* barely tinted text */
--color-red-100: #ffd0d0; /* muted red text */
--color-red-200: #ff9999; /* disabled */
--color-red-300: #ff6666; /* hover */
--color-red-400: #ff3333; /* active */
--color-red-500: #ff0000; /* PRIMARY brand red */
--color-red-600: #cc0000; /* pressed */
--color-red-700: #990000; /* dark red */
```

**Semantic mappings** (used in components):

```css
--color-primary: var(--color-red-500);
--color-primary-hover: var(--color-red-400);
--color-primary-active: var(--color-red-600);
--color-primary-ring: var(--color-red-300);

--color-success: #00cc44;
--color-warning: #ffaa00;
--color-error: var(--color-red-500);

--color-muted: #ffffff40;     /* white 25% */
--color-border: #ffffff1a;   /* white 10% */
--color-border-strong: #ffffff33; /* white 20% */

--color-bg-page: var(--color-black-300);
--color-bg-card: var(--color-black-100);
--color-bg-elevated: var(--color-black-50);
--color-bg-input: var(--color-black-200);

--color-text-primary: #ffffff;
--color-text-secondary: #ffffffcc; /* 80% */
--color-text-muted: #ffffff66;    /* 40% */
--color-text-inverse: #000000;
```

### 1.2 Spacing & Layout Tokens

```css
--space-unit: 4px; /* base unit */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
--space-3xl: 64px;

--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;

--container-max: 80rem;     /* 1280px */
--container-narrow: 48rem;  /* 768px */

--header-height: 64px;
--sidebar-width: 280px;
--sidebar-collapsed: 72px;
```

### 1.3 Typography Tokens

```css
--font-display: 'Syne', sans-serif;      /* headings, logo, numbers */
--font-body: 'Inter', sans-serif;        /* UI, body, forms */
--font-mono: 'JetBrains Mono', monospace; /* code, IDs */

--text-display-xl: clamp(2.5rem, 5vw, 4rem) / 1.1;
--text-display-lg: clamp(2rem, 4vw, 3rem) / 1.15;
--text-display-md: clamp(1.5rem, 3vw, 2.25rem) / 1.2;
--text-heading-lg: 1.5rem / 1.3;
--text-heading-md: 1.25rem / 1.35;
--text-heading-sm: 1rem / 1.4;
--text-body-lg: 1.125rem / 1.6;
--text-body: 1rem / 1.6;
--text-body-sm: 0.875rem / 1.5;
--text-caption: 0.75rem / 1.5;

--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 1.4 Motion Tokens

```css
--duration-fast: 120ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 1.5 Focus & Elevation Tokens

```css
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-color: var(--color-primary-ring);
--focus-ring-offset-color: var(--color-bg-page);

--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.3);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.3);
--shadow-glow: 0 0 24px 0 rgb(255 0 0 / 0.5);
--shadow-glow-subtle: 0 0 16px 0 rgb(255 0 0 / 0.3);

--glass-bg: rgba(20, 20, 20, 0.6);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-blur: blur(12px);
```

---

## 2. Typography Implementation

### 2.1 Font Loading (`apps/web/src/app/fonts.ts`)

```ts
import { Syne, Inter, JetBrains_Mono } from 'next/font/google';

export const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  preload: true,
  weight: ['200', '300', '400', '500', '600', '700', '800'],
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
```

### 2.2 Global Styles (`apps/web/src/app/globals.css`)

```css
@import "tailwindcss";
@import "./tokens.css"; /* @theme block + all custom properties above */

@layer base {
  :root {
    color-scheme: dark;
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  html {
    scroll-behavior: smooth;
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
  body {
    background-color: var(--color-bg-page);
    color: var(--color-text-primary);
    font-size: var(--text-body);
  }
  /* Skip link */
  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-radius: var(--radius-md);
    z-index: 9999;
    transition: top var(--duration-fast) var(--ease-out);
  }
  .skip-link:focus { top: var(--space-md); }
  /* Focus visible default */
  *:focus-visible {
    outline: none;
    ring: var(--focus-ring-width) solid var(--focus-ring-color);
    ring-offset: var(--focus-ring-offset);
    ring-offset-color: var(--focus-ring-offset-color);
  }
  /* Selection */
  ::selection {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }
  /* Scrollbar */
  * { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: var(--radius-full);
  }
  *::-webkit-scrollbar-thumb:hover { background: var(--color-muted); }
}
```

### 2.3 Tailwind v4 `@theme` (`apps/web/src/app/tokens.css`)

```css
@theme {
  /* Colors - map to CSS custom properties */
  --color-black-50: var(--color-black-50);
  --color-black-100: var(--color-black-100);
  --color-black-200: var(--color-black-200);
  --color-black-300: var(--color-black-300);
  --color-black-400: var(--color-black-400);
  --color-black-500: var(--color-black-500);
  --color-black-600: var(--color-black-600);
  --color-red-50: var(--color-red-50);
  --color-red-100: var(--color-red-100);
  --color-red-200: var(--color-red-200);
  --color-red-300: var(--color-red-300);
  --color-red-400: var(--color-red-400);
  --color-red-500: var(--color-red-500);
  --color-red-600: var(--color-red-600);
  --color-red-700: var(--color-red-700);
  /* Semantic */
  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-primary-active: var(--color-primary-active);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-error: var(--color-error);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --color-border-strong: var(--color-border-strong);
  --color-bg-page: var(--color-bg-page);
  --color-bg-card: var(--color-bg-card);
  --color-bg-elevated: var(--color-bg-elevated);
  --color-bg-input: var(--color-bg-input);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-text-inverse: var(--color-text-inverse);
  /* Fonts */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);
  /* Spacing */
  --spacing-unit: var(--space-unit);
  --spacing-xs: var(--space-xs);
  --spacing-sm: var(--space-sm);
  --spacing-md: var(--space-md);
  --spacing-lg: var(--space-lg);
  --spacing-xl: var(--space-xl);
  --spacing-2xl: var(--space-2xl);
  --spacing-3xl: var(--space-3xl);
  /* Radius */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-full: var(--radius-full);
  /* Shadows */
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-glow: var(--shadow-glow);
  --shadow-glow-subtle: var(--shadow-glow-subtle);
  /* Motion */
  --duration-fast: var(--duration-fast);
  --duration-base: var(--duration-base);
  --duration-slow: var(--duration-slow);
  --duration-slower: var(--duration-slower);
  --ease-out: var(--ease-out);
  --ease-in-out: var(--ease-in-out);
  --ease-spring: var(--ease-spring);
  /* Focus */
  --focus-ring: var(--focus-ring-width) solid var(--focus-ring-color);
  --focus-ring-offset: var(--focus-ring-offset) var(--focus-ring-offset-color);
  /* Glass */
  --glass-bg: var(--glass-bg);
  --glass-border: var(--glass-border);
  --glass-blur: var(--glass-blur);
}
```

---

## 3. Design System Primitives (Radix + Custom Styling)

### 3.1 Installation

```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip \
  @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-select \
  @radix-ui/react-avatar @radix-ui/react-separator @radix-ui/react-slot \
  @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-label @radix-ui/react-progress \
  class-variance-authority clsx tailwind-merge
```

### 3.2 Primitive Library Structure

```
apps/web/src/components/ui/
├── button.tsx       # Button (primary, secondary, ghost, destructive, icon)
├── input.tsx        # Input, Textarea
├── select.tsx       # Select (Radix Select + custom styling)
├── card.tsx         # Card, CardHeader, CardContent, CardFooter
├── badge.tsx        # Badge (default, success, warning, error, outline)
├── modal.tsx        # Modal (Radix Dialog + glassmorphism)
├── toast.tsx        # Toast + Toaster (Radix Toast)
├── tooltip.tsx      # Tooltip (Radix Tooltip)
├── dropdown.tsx     # DropdownMenu (Radix DropdownMenu)
├── tabs.tsx         # Tabs (Radix Tabs)
├── table.tsx        # Table, TableHeader, TableRow, TableCell
├── progress.tsx     # Progress bar
├── avatar.tsx       # Avatar, AvatarFallback
├── separator.tsx    # Separator
├── skeleton.tsx     # Skeleton (shimmer)
├── empty-state.tsx  # EmptyState (illustrated)
├── label.tsx        # Label (with required asterisk)
├── checkbox.tsx     # Checkbox (Radix Checkbox)
├── switch.tsx       # Switch (Radix Switch)
└── utils.ts         # cn(), variants
```

### 3.3 Core Primitive Examples

**Button** (`button.tsx`):

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-fast ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page ' +
    'disabled:opacity-50 disabled:pointer-events-none ' +
    'active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-glow-subtle',
        secondary: 'bg-bg-elevated text-text-primary border border-border hover:bg-bg-input hover:border-border-strong',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-input',
        destructive: 'bg-error text-text-inverse hover:bg-red-400 shadow-glow-subtle',
        outline: 'border-2 border-border hover:border-border-strong bg-transparent',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm rounded-md',
        md: 'h-10 px-4 text-body rounded-lg',
        lg: 'h-12 px-6 text-body-lg rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';
export { Button, buttonVariants };
```

**Card** (`card.tsx`) — glassmorphism:

```tsx
import { cn } from './utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl bg-bg-card/60 backdrop-blur-sm border border-border',
        'shadow-md transition-all duration-base ease-out',
        'hover:shadow-lg hover:border-border-strong',
        className
      )}
      {...props}
    />
  )
);

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-4 border-b border-border', className)} {...props} />
  )
);

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
  )
);

export { Card, CardHeader, CardContent };
```

**Input** (`input.tsx`):

```tsx
import { cn } from './utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-body-sm font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full h-10 px-3 rounded-lg bg-bg-input border border-border',
            'text-text-primary placeholder:text-text-muted',
            'transition-all duration-fast ease-out',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'invalid:border-error invalid:focus:border-error invalid:focus:ring-error/20',
            error && 'border-error focus:border-error focus:ring-error/20',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-body-sm text-error" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-body-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
```

---

## 4. App Shell & Navigation

### 4.1 Root Layout (`apps/web/src/app/layout.tsx`)

```tsx
import { syne, inter, mono } from './fonts';
import './globals.css';
import { Toaster } from '@/components/ui/toast';
import { ModalProvider } from '@/components/ui/modal';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AIVA - AI Video Generator',
  description: 'AI-powered YouTube content production platform',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-bg-page text-text-primary antialiased flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Header />
        <main id="main-content" className="flex-1 w-full">
          {children}
        </main>
        <Footer />
        <ModalProvider>
          <Toaster />
        </ModalProvider>
      </body>
    </html>
  );
}
```

### 4.2 Header (`apps/web/src/components/layout/header.tsx`)

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, User, Settings, FolderGit2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/components/ui/utils';
import { useAuth } from '@/lib/auth/client';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-bg-page/80 backdrop-blur-sm border-b border-border z-50">
      <div className="max-w-[var(--container-max)] mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="AIVA Home">
          <span className="font-display font-bold text-xl text-text-primary">AIVA</span>
          <span className="hidden sm:inline-block w-px h-6 bg-border mx-2" aria-hidden="true" />
          <span className="hidden md:inline text-body-sm text-text-muted font-medium">AI Video Generator</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-all duration-fast',
                pathname === href ? 'bg-bg-elevated text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
              )}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary text-text-inverse font-display font-bold">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-body-sm font-medium text-text-primary">{user.name}</p>
                  <p className="text-caption text-text-muted truncate">{user.email}</p>
                </div>
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-error">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav id="mobile-nav" className="md:hidden border-t border-border bg-bg-page py-3 px-4 animate-slide-down">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-body font-medium transition-all duration-fast',
                  pathname === href ? 'bg-bg-elevated text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
                )}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
```

### 4.3 Footer (`apps/web/src/components/layout/footer.tsx`)

```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-card/50 backdrop-blur-sm">
      <div className="max-w-[var(--container-max)] mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-body-sm text-text-muted">
            © {new Date().getFullYear()} AIVA. AI-powered YouTube content production.
          </p>
          <nav className="flex items-center gap-4" aria-label="Footer links">
            <Link href="/privacy" className="text-body-sm text-text-muted hover:text-text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-body-sm text-text-muted hover:text-text-primary transition-colors">
              Terms
            </Link>
            <Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-body-sm text-text-muted hover:text-text-primary transition-colors">
              GitHub
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
```

### 4.4 Dashboard Layout (`apps/web/src/app/(dashboard)/layout.tsx`)

```tsx
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 w-full pt-[var(--header-height)]">
        <div className="max-w-[var(--container-max)] mx-auto px-4 py-6 md:py-10">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

---

## 5. Per-Page Layouts

### 5.1 Home Dashboard (`apps/web/src/app/page.tsx`)

```tsx
'use client';
import { InitializePipeline } from '@/components/dashboard/initialize-pipeline';
import { OperationsConsole } from '@/components/dashboard/operations-console';
import { OperationsSummaryHeader } from '@/components/ui/operations-summary-header';
import { OperationsDashboardProvider, useOperations } from '@/providers/OperationsDashboardProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <OperationsDashboardProvider>
      <DashboardContent />
    </OperationsDashboardProvider>
  );
}

function DashboardContent() {
  const { projects, isLoading } = useOperations();
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary">Dashboard</h1>
          <p className="text-body text-text-secondary mt-1">Create videos and monitor your generation pipeline.</p>
        </div>
        <Link href="/projects/new" className="shrink-0">
          <Button size="lg"><Plus className="w-4 h-4 mr-2" /> Create Video</Button>
        </Link>
      </div>

      {/* Stats Row */}
      <OperationsSummaryHeader projects={projects} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create Pipeline */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardContent className="p-6 h-full">
              <InitializePipeline />
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue Control */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              {isLoading ? <OperationsConsoleSkeleton /> : <OperationsConsole />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OperationsConsoleSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### 5.2 Login Page (`apps/web/src/app/login/page.tsx`)

```tsx
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { signIn } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn(email, password, isLogin ? 'login' : 'signup');
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-height)-var(--footer-height))] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <span className="font-display font-bold text-xl text-primary">A</span>
          </div>
          <CardTitle className="font-display text-display-sm">{isLogin ? 'Welcome back' : 'Create account'}</CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to access your dashboard' : 'Start creating AI videos today'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                  disabled={isLoading}
                  spellCheck={false}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <Link href="/forgot-password" className="text-body-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-body-sm text-text-muted">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="ml-2 text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

### 5.3 Settings Page (`apps/web/src/app/(dashboard)/settings/page.tsx`)

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast } from '@/components/ui/toast';
import { Key, Cpu, Server, Layers, Save, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'providers', label: 'Providers', icon: Layers },
  { id: 'llm', label: 'LLM Config', icon: Server },
  { id: 'ollama', label: 'Ollama', icon: Cpu },
  { id: 'api-keys', label: 'API Keys', icon: Key },
] as const;

const PRESET_URLS = [
  { label: 'Cloud / Direct (OpenRouter)', url: 'https://openrouter.ai/api/v1' },
  { label: 'Local Gateway (OmniRoute)', url: 'http://localhost:20128/v1' },
  { label: 'Local Hardware (Ollama /v1)', url: 'http://localhost:11434/v1' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('providers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<FetchStatus | null>(null);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customOllamaModelMode, setCustomOllamaModelMode] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // ... fetchSettings, handleSave, handleFetchModels, handleTestOllama (same logic, updated UI)

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary">
            <Server className="w-8 h-8 text-primary inline-block mr-3" /> Settings
          </h1>
          <p className="text-body text-text-secondary mt-1">
            Configure AI models, credentials, and local inference endpoints.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <Toast type={toast.type} title={toast.type === 'success' ? 'Saved' : 'Error'} message={toast.message} onClose={() => setToast(null)} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="flex items-center justify-center gap-2 px-4 py-3">
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Active Stage Providers
              </CardTitle>
              <CardDescription>Select the active provider for each pipeline stage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProviderSelect label="LLM Provider (Scripting & Outline)" name="llm_provider" value={form.llm_provider} onChange={handleChange}
                options={[
                  { value: 'openai_compatible', label: 'OpenAI-Compatible Endpoint' },
                  { value: 'ollama', label: 'Ollama (100% Offline Local Model)' },
                ]}
              />
              <ProviderSelect label="TTS Provider (Voiceover)" name="tts_provider" value={form.tts_provider} onChange={handleChange}
                options={[
                  { value: 'edge_tts', label: 'EdgeTTS (Free Cloud Neural Voices)' },
                  { value: 'kokoro', label: 'Kokoro-82M (Self-Hosted Local TTS)' },
                  { value: 'elevenlabs', label: 'ElevenLabs (High-Quality API)' },
                ]}
              />
              <ProviderSelect label="Image Generator" name="image_provider" value={form.image_provider} onChange={handleChange}
                options={[
                  { value: 'sdxl', label: 'Cloudflare Workers AI (SDXL)' },
                  { value: 'pexels', label: 'Pexels Stock Photos' },
                ]}
              />
              <ProviderSelect label="B-Roll Video Provider" name="broll_provider" value={form.broll_provider} onChange={handleChange}
                options={[
                  { value: 'pexels', label: 'Pexels Video API' },
                  { value: 'pixabay', label: 'Pixabay Video API' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Config Tab */}
        <TabsContent value="llm" className="space-y-6">
          {form.llm_provider !== 'ollama' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-primary" /> OpenAI-Compatible LLM Configuration
                  </CardTitle>
                  <CardDescription>Configure your OpenAI-compatible endpoint and discover available models.</CardDescription>
                </div>
                <Button variant="secondary" size="sm" onClick={handleFetchModels} disabled={fetchingModels || !form.llm_base_url}>
                  {fetchingModels ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Fetching…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" /> Fetch Models
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {fetchModelsStatus && (
                  <Alert variant={fetchModelsStatus.connected ? 'default' : 'destructive'}>
                    <AlertDescription className="flex items-center gap-2">
                      {fetchModelsStatus.connected ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-error" />}
                      {fetchModelsStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Preset URLs */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-body-sm text-text-muted self-center mr-2">Presets:</span>
                  {PRESET_URLS.map(({ label, url }) => (
                    <Button key={url} type="button" variant="outline" size="sm"
                      onClick={() => { setForm((p) => ({ ...p, llm_base_url: url })); setFetchModelsStatus(null); }}>
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Base URL" name="llm_base_url" type="url" placeholder="https://openrouter.ai/api/v1"
                    value={form.llm_base_url} onChange={handleChange} autoComplete="off" />
                  <Input label="API Key" name="llm_api_key" type="password" placeholder="sk-…"
                    value={form.llm_api_key} onChange={handleChange} autoComplete="off" spellCheck={false} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Model ID</Label>
                    {availableModels.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCustomModelMode(!customModelMode)}>
                        {customModelMode ? 'Select from list' : 'Enter custom model ID'}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {availableModels.length > 0 && !customModelMode ? (
                      <Select name="llm_model" value={form.llm_model} onChange={handleChange}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select model…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input name="llm_model" type="text" placeholder="google/gemini-flash-1.5" value={form.llm_model} onChange={handleChange} className="flex-1" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Ollama Tab */}
        <TabsContent value="ollama" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" /> Local Offline AI Models (Ollama)
                </CardTitle>
                <CardDescription>Connect to a local Ollama instance for fully offline inference.</CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleTestOllama()} disabled={testingOllama}>
                {testingOllama ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Testing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" /> Test Connection
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {ollamaStatus && (
                <Alert variant={ollamaStatus.connected ? 'default' : 'destructive'}>
                  <AlertDescription className="flex items-center gap-2">
                    {ollamaStatus.connected ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-error" />}
                    {ollamaStatus.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Ollama Host URL" name="ollama_base_url" type="url" placeholder="http://localhost:11434"
                  value={form.ollama_base_url} onChange={handleChange} />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Detected Models</Label>
                    {ollamaStatus?.models?.length && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCustomOllamaModelMode(!customOllamaModelMode)}>
                        {customOllamaModelMode ? 'Select from detected list' : 'Enter custom model name'}
                      </Button>
                    )}
                  </div>
                  {ollamaStatus?.models?.length && !customOllamaModelMode ? (
                    <Select name="ollama_model" value={form.ollama_model} onChange={handleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ollamaStatus.models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input name="ollama_model" type="text" placeholder="llama3.2 or deepseek-r1" value={form.ollama_model} onChange={handleChange} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" /> Cloud API Keys (AES-256 Encrypted)
              </CardTitle>
              <CardDescription>Keys are encrypted at rest and never exposed in plaintext.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input label="ElevenLabs API Key" name="elevenlabs_api_key" type="password" placeholder="eleven_…"
                value={form.elevenlabs_api_key} onChange={handleChange} autoComplete="off" spellCheck={false} />
              <Input label="Pexels API Key" name="pexels_api_key" type="password" placeholder="Pexels API Key"
                value={form.pexels_api_key} onChange={handleChange} autoComplete="off" spellCheck={false} />
              <Input label="Cloudflare Workers AI Token" name="cloudflare_api_key" type="password" placeholder="Cloudflare Token"
                value={form.cloudflare_api_key} onChange={handleChange} autoComplete="off" spellCheck={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProviderSelect({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select name={name} value={value} onChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select provider…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-12 w-full" />
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-80 w-full" />)}
    </div>
  );
}
```

### 5.4 Projects List Page (`apps/web/src/app/(dashboard)/projects/page.tsx`) — NEW

```tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Film, ExternalLink, Trash2, MoreHorizontal, Calendar, Clock, CheckCircle, AlertCircle, Loader2, PauseCircle, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { formatDistanceToNow } from 'date-fns';
import { useOperations } from '@/providers/OperationsDashboardProvider';

export default function ProjectsPage() {
  const { projects, isLoading, refresh } = useOperations();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <ProjectsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary">Projects</h1>
          <p className="text-body text-text-secondary mt-1">Browse and manage your video generation projects.</p>
        </div>
        <Link href="/projects/new">
          <Button size="lg"><Plus className="w-4 h-4 mr-2" /> New Project</Button>
        </Link>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first video project to get started."
          action={{ label: 'Create Project', href: '/projects/new' }} icon={Film} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={handleDelete} deleting={deletingId === project.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onDelete, deleting }: { project: ProjectRow; onDelete: (id: string) => void; deleting: boolean }) {
  const statusConfig = {
    completed: { label: 'Completed', variant: 'success' as const, icon: <CheckCircle className="w-3 h-3" /> },
    failed: { label: 'Failed', variant: 'destructive' as const, icon: <AlertCircle className="w-3 h-3" /> },
    generating: { label: 'Generating', variant: 'default' as const, icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    queued: { label: 'Queued', variant: 'secondary' as const, icon: <Clock className="w-3 h-3" /> },
    paused: { label: 'Paused', variant: 'warning' as const, icon: <PauseCircle className="w-3 h-3" /> },
    cancelled: { label: 'Cancelled', variant: 'outline' as const, icon: <XCircle className="w-3 h-3" /> },
  } as const;

  const config = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.queued;

  return (
    <Card className="group overflow-hidden flex flex-col h-full transition-all duration-base">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-input overflow-hidden">
        {project.thumbnail_url ? (
          <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Film className="w-12 h-12" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge variant={config.variant} className="gap-1">
            {config.icon} {config.label}
          </Badge>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-text-primary truncate">{project.title || 'Untitled'}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`}><ExternalLink className="w-4 h-4 mr-2" /> View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}/timeline`}><Film className="w-4 h-4 mr-2" /> Timeline Studio</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(project.id)} disabled={deleting} className="text-error focus:text-error">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-body-sm text-text-secondary line-clamp-2">{project.topic}</p>

        <div className="flex items-center gap-3 text-caption text-text-muted mt-auto pt-2 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </span>
          {project.duration_target_seconds && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {project.duration_target_seconds}s
            </span>
          )}
        </div>

        <Link href={`/projects/${project.id}`} className="mt-2">
          <Button variant="primary" className="w-full" size="sm">Open Project</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full mt-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 5.5 Project Overview (`apps/web/src/app/(dashboard)/projects/[id]/page.tsx`)

- Keep existing structure, wrap in `Card` components, use `Badge` for status, `Button` for actions, add `Skeleton` loading states.

### 5.6 Timeline Studio (`apps/web/src/app/(dashboard)/projects/[id]/timeline/page.tsx`)

- Wrap scene cards in `Card`, use `Tabs` if multiple views, `Modal` for confirmations, `Toast` for rerender feedback.

---

## 6. File Structure & Implementation Order

```
apps/web/
├── src/
│   ├── app/
│   │   ├── globals.css              # ← UPDATE: import tokens.css, base styles
│   │   ├── tokens.css               # ← NEW: @theme + all design tokens
│   │   ├── fonts.ts                 # ← NEW: next/font config
│   │   ├── layout.tsx               # ← UPDATE: Header, Footer, providers
│   │   ├── page.tsx                 # ← REWRITE: new home dashboard
│   │   ├── login/page.tsx           # ← REWRITE: new login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # ← NEW: dashboard shell
│   │   │   ├── settings/page.tsx    # ← REWRITE: tabbed settings
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx         # ← NEW: projects list
│   │   │   │   ├── [id]/page.tsx    # ← REWRITE: project overview
│   │   │   │   ├── [id]/timeline/page.tsx  # ← REWRITE: timeline studio
│   │   │   └── components/
│   │   ├── components/
│   │   │   ├── dashboard/           # ← UPDATE: use new primitives
│   │   │   ├── layout/
│   │   │   │   ├── header.tsx       # ← NEW
│   │   │   │   └── footer.tsx       # ← NEW
│   │   │   └── ui/                  # ← NEW: all primitives
│   │   ├── lib/
│   │   │   ├── auth/client.ts       # ← UPDATE: useAuth hook
│   │   │   └── utils.ts             # ← NEW: cn(), variants
│   │   ├── providers/
│   │   │   ├── OperationsDashboardProvider.tsx  # ← KEEP
│   │   │   └── DashboardProvider.tsx             # ← KEEP
│   ├── package.json                 # ← UPDATE: add Radix, cva, clsx, tailwind-merge
│   ├── postcss.config.mjs           # ← KEEP
└── └── tsconfig.json                # ← KEEP
```

### Implementation Order (Q30=A)

1. **Tokens & Fonts** — `tokens.css`, `fonts.ts`, update `globals.css`, `layout.tsx` imports
2. **Utilities** — `lib/utils.ts` (`cn`), `lib/auth/client.ts` (`useAuth`)
3. **Primitives** — all files in `components/ui/` (build Storybook stories in parallel)
4. **Layout** — `Header`, `Footer`, `(dashboard)/layout.tsx`, update root `layout.tsx`
5. **Pages** — `login/page.tsx` → `page.tsx` (home) → `settings/page.tsx` → `projects/page.tsx` → `projects/[id]/page.tsx` → `projects/[id]/timeline/page.tsx`
6. **Dashboard Components** — migrate `components/dashboard/*` to use new primitives
7. **Feature Flag** — wrap new routes in `NEXT_PUBLIC_NEW_DESIGN` check
8. **Testing** — Storybook + Playwright setup

---

## 7. Motion & Animation Guidelines

- **Only `transform` / `opacity`** animations (compositor-friendly)
- **Duration tokens** — use `--duration-fast/base/slow/slower` consistently
- **Easing tokens** — `--ease-out` for enter, `--ease-in-out` for exit, `--ease-spring` for playful
- **Respect `prefers-reduced-motion`** — global media query disables all non-essential motion
- **Staggered entrance** — page sections animate in with 50ms stagger
- **Hover/tap feedback** — `active:scale-[0.98]` on all interactive elements
- **Loading shimmer** — `animate-pulse` on skeletons (respects reduced-motion)

---

## 8. Accessibility Requirements (WCAG AA)

- **Color contrast** — all text ≥ 4.5:1, UI elements ≥ 3:1 (verified with palette)
- **Focus visible** — 2px ring, 2px offset, primary color on all interactive elements
- **Skip link** — first focusable element on every page
- **Heading hierarchy** — single `<h1>` per page, logical `<h2>`–`<h6>` nesting
- **Landmarks** — `<header>`, `<main>`, `<nav>`, `<footer>`, `<aside>` where appropriate
- **ARIA labels** — all icon-only buttons, selects, tabs, dialogs
- **Live regions** — `aria-live="polite"` for toasts, status updates, polling changes
- **Form labels** — every input has `<label htmlFor>` or wrapping `<label>`
- **Error handling** — inline errors with `aria-describedby`, focus first error on submit
- **Keyboard navigation** — all interactive elements reachable, `Tab` order logical
- **Touch targets** — minimum 44×44px (buttons, links, checkboxes)
- **Reduced motion** — respected globally

---

## 9. Testing Strategy

### 9.1 Storybook (`/.storybook/`)

- **Components** — all 20+ primitives with controls for variants, states, dark mode
- **Addons** — `@storybook/addon-a11y`, `@chromatic/storybook` for visual regression
- **Stories** — each primitive: Default, Hover, Focus, Disabled, Loading, Error

### 9.2 Playwright (`/e2e/`)

```ts
// e2e/critical-flows.spec.ts
test.describe('Critical flows (new design)', () => {
  test('Login → Create project → Settings → Project → Timeline', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]', 'test@aiva.local');
    await page.fill('[name=password]', 'password');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/');

    // Create project
    await page.fill('[name=topic]', 'Test video');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/projects\//);

    // Settings
    await page.goto('/settings');
    await expect(page.locator('[role=tablist]')).toBeVisible();

    // Project list
    await page.goto('/projects');
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(1);

    // Timeline
    await page.click('a[href*="/timeline"]');
    await expect(page.locator('h1:has-text("Timeline Studio")')).toBeVisible();
  });

  test('A11y audit on all pages', async ({ page }) => {
    for (const url of ['/', '/login', '/settings', '/projects', '/projects/1', '/projects/1/timeline']) {
      await page.goto(url);
      const violations = await new AxeBuilder({ page }).analyze();
      expect(violations).toEqual([]);
    }
  });
});
```

---

## 10. Rollout Plan (Q40=B)

1. **Feature flag** — `NEXT_PUBLIC_NEW_DESIGN=true` enables new routes
2. **Staging deploy** — flag ON in staging, full QA (visual + a11y + flows)
3. **Gradual rollout** — 10% → 50% → 100% via edge config
4. **Rollback** — flag OFF reverts to `/legacy/*` routes (old pages preserved for 1 sprint)
5. **Cleanup** — after 2 weeks stable, remove flag, delete legacy routes

---

## 11. Dependencies to Add

```json
{
  "dependencies": {
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@storybook/nextjs": "^8.2.0",
    "@storybook/addon-a11y": "^8.2.0",
    "@chromatic/storybook": "^1.5.0",
    "@playwright/test": "^1.45.0",
    "axe-playwright": "^2.0.0"
  }
}
```
