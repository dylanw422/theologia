# Auth Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/sign-in` and `/sign-up` pages with a full-screen Creation of Adam background, dark frosted-glass card, and custom-styled forms matching the hero aesthetic.

**Architecture:** A shared `AuthLayout` component owns the full-screen background (Creation of Adam fresco + vignette + grain), wordmark, and centered card. Each page is a thin wrapper that renders `AuthLayout` with the appropriate form. The existing form components keep their `@tanstack/react-form` + `better-auth` logic but shed shadcn/ui elements in favor of CSS Module classes that mirror the hero design tokens.

**Tech Stack:** Next.js 15 App Router, CSS Modules, `better-auth` client, `@tanstack/react-form`, `sonner`, Fraunces + Geist Mono fonts via CSS variables already on `<body>`.

## Global Constraints

- CSS Modules only — no Tailwind in new files; follow hero.module.css patterns
- Design tokens must be redeclared locally on the layout root (no global CSS dependency)
- Font variables (`--font-fraunces`, `--font-geist-mono`, `--font-inter`) come from `<body>` class — use them via `var()`
- Background image: `/creation-of-adam.jpg` (already in `public/`)
- Auth logic unchanged: `authClient.signIn.email()` / `authClient.signUp.email()`, success → `/dashboard`
- Errors via `sonner` toast — keep existing pattern
- No shadcn `Button`, `Input`, or `Label` in modified form files

---

### Task 1: AuthLayout component + CSS

**Files:**
- Create: `apps/web/src/components/auth-layout.tsx`
- Create: `apps/web/src/components/auth-layout.module.css`

**Interfaces:**
- Produces: `AuthLayout({ children: React.ReactNode }): JSX.Element` — used by Tasks 3 and 4

- [ ] **Step 1: Create `auth-layout.module.css`**

```css
/* apps/web/src/components/auth-layout.module.css */
.root {
  --ink: #14100a;
  --ink-deep: #0b0805;
  --parchment: #f1e8d6;
  --parchment-dim: #b9a886;
  --stone: #8a7d68;
  --gold: #c9a24e;
  --gold-bright: #e6c984;
  --hairline: rgba(201, 162, 78, 0.26);

  position: relative;
  isolation: isolate;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--ink-deep);
  color: var(--parchment);
  font-family: var(--font-inter), system-ui, sans-serif;
}

.fresco {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: url("/creation-of-adam.jpg") center 40% / cover no-repeat;
  filter: saturate(1.1) contrast(1.08) brightness(0.38);
  transform: scale(1.05);
}
@media (prefers-reduced-motion: no-preference) {
  .fresco {
    animation: drift 46s ease-in-out infinite alternate;
  }
}
@keyframes drift {
  from { transform: scale(1.05) translate3d(0, 0, 0); }
  to   { transform: scale(1.12) translate3d(-1.2%, -0.8%, 0); }
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(11,8,5,0.78) 0%, rgba(11,8,5,0) 22%),
    linear-gradient(180deg, rgba(11,8,5,0) 60%, rgba(11,8,5,0.88) 100%),
    radial-gradient(
      130% 100% at 50% 44%,
      rgba(11,8,5,0) 30%,
      rgba(11,8,5,0.55) 80%,
      rgba(11,8,5,0.94) 100%
    );
}

.grain {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.shell {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100svh;
}

.nav {
  padding: clamp(1.15rem, 2.4vw, 1.9rem) clamp(1.25rem, 4vw, 3.5rem);
}

.wordmark {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 500;
  font-size: 1.4rem;
  letter-spacing: 0.01em;
  color: var(--parchment);
  text-decoration: none;
}

.main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 5vh, 5rem) clamp(1.25rem, 4vw, 3.5rem);
}

.card {
  width: 100%;
  max-width: 420px;
  background: rgba(11, 8, 5, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(201, 162, 78, 0.28);
  border-radius: 2px;
  padding: 2.4rem 2.8rem;
}

.cardTitle {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-size: 1.75rem;
  color: var(--parchment);
  margin-bottom: 1.8rem;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 2: Create `auth-layout.tsx`**

```tsx
// apps/web/src/components/auth-layout.tsx
import Link from "next/link";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.fresco} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.grain} aria-hidden />
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.wordmark}>Theologia</Link>
        </nav>
        <main className={styles.main}>
          <div className={styles.card}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -E "auth-layout" || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth-layout.tsx apps/web/src/components/auth-layout.module.css
git commit -m "feat: add AuthLayout component with Creation of Adam background"
```

---

### Task 2: Restyle SignInForm

**Files:**
- Modify: `apps/web/src/components/sign-in-form.tsx`
- Create: `apps/web/src/components/auth-form.module.css` (shared form styles, used by both forms)

**Interfaces:**
- Consumes: `AuthLayout` (wraps the form — Task 1)
- Produces: `SignInForm(): JSX.Element` — no props (navigation handled via `<Link>`, not callback)

- [ ] **Step 1: Create `auth-form.module.css`**

```css
/* apps/web/src/components/auth-form.module.css */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1.1rem;
}

.label {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--parchment-dim, #b9a886);
}

.input {
  width: 100%;
  background: rgba(11, 8, 5, 0.55);
  border: 1px solid rgba(201, 162, 78, 0.26);
  border-radius: 2px;
  color: var(--parchment, #f1e8d6);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  padding: 0.85rem 1rem;
  outline: none;
  transition: border-color 0.22s ease;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.input::placeholder {
  color: var(--stone, #8a7d68);
}
.input:focus {
  border-color: rgba(201, 162, 78, 0.55);
}

.error {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: #c0392b;
  margin-top: 0.2rem;
}

.btnPrimary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: var(--gold, #c9a24e);
  color: #1a1206;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.95rem 1.65rem;
  border: 1px solid var(--gold, #c9a24e);
  border-radius: 2px;
  cursor: pointer;
  margin-top: 0.6rem;
  transition:
    background 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease;
}
.btnPrimary:hover:not(:disabled) {
  background: var(--gold-bright, #e6c984);
  transform: translateY(-1px);
  box-shadow: 0 14px 34px -14px rgba(201, 162, 78, 0.6);
}
.btnPrimary:disabled {
  opacity: 0.55;
  cursor: default;
}

.switchText {
  margin-top: 1.4rem;
  text-align: center;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: var(--stone, #8a7d68);
}

.switchLink {
  color: var(--parchment-dim, #b9a886);
  text-decoration: none;
  margin-left: 0.35em;
  transition: color 0.2s ease;
}
.switchLink:hover {
  color: var(--gold, #c9a24e);
}
```

- [ ] **Step 2: Rewrite `sign-in-form.tsx`**

```tsx
// apps/web/src/components/sign-in-form.tsx
"use client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import styles from "./auth-form.module.css";

export default function SignInForm() {
  const router = useRouter();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Email</label>
            <input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Password</label>
            <input
              id={field.name}
              name={field.name}
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        )}
      </form.Subscribe>

      <p className={styles.switchText}>
        No account?
        <Link href="/sign-up" className={styles.switchLink}>Sign up</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -E "sign-in-form|auth-form" || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sign-in-form.tsx apps/web/src/components/auth-form.module.css
git commit -m "feat: restyle SignInForm with dark auth-form CSS modules"
```

---

### Task 3: Restyle SignUpForm

**Files:**
- Modify: `apps/web/src/components/sign-up-form.tsx`

**Interfaces:**
- Consumes: `auth-form.module.css` (Task 2)
- Produces: `SignUpForm(): JSX.Element` — no props

- [ ] **Step 1: Rewrite `sign-up-form.tsx`**

```tsx
// apps/web/src/components/sign-up-form.tsx
"use client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import styles from "./auth-form.module.css";

export default function SignUpForm() {
  const router = useRouter();

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Account created");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Name</label>
            <input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="Your name"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Email</label>
            <input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Password</label>
            <input
              id={field.name}
              name={field.name}
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Create Account"}
          </button>
        )}
      </form.Subscribe>

      <p className={styles.switchText}>
        Already have an account?
        <Link href="/sign-in" className={styles.switchLink}>Sign in</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -E "sign-up-form" || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sign-up-form.tsx
git commit -m "feat: restyle SignUpForm with dark auth-form CSS modules"
```

---

### Task 4: Create /sign-in and /sign-up pages + update hero nav

**Files:**
- Create: `apps/web/src/app/sign-in/page.tsx`
- Create: `apps/web/src/app/sign-up/page.tsx`
- Modify: `apps/web/src/components/hero.tsx` (one line: `/dashboard` → `/sign-in`)

**Interfaces:**
- Consumes: `AuthLayout` (Task 1), `SignInForm` (Task 2), `SignUpForm` (Task 3)

- [ ] **Step 1: Create `app/sign-in/page.tsx`**

```tsx
// apps/web/src/app/sign-in/page.tsx
import AuthLayout from "@/components/auth-layout";
import SignInForm from "@/components/sign-in-form";
import styles from "@/components/auth-layout.module.css";

export const metadata = {
  title: "Sign In — Theologia",
};

export default function SignInPage() {
  return (
    <AuthLayout>
      <h1 className={styles.cardTitle}>Welcome back</h1>
      <SignInForm />
    </AuthLayout>
  );
}
```

- [ ] **Step 2: Create `app/sign-up/page.tsx`**

```tsx
// apps/web/src/app/sign-up/page.tsx
import AuthLayout from "@/components/auth-layout";
import SignUpForm from "@/components/sign-up-form";
import styles from "@/components/auth-layout.module.css";

export const metadata = {
  title: "Create Account — Theologia",
};

export default function SignUpPage() {
  return (
    <AuthLayout>
      <h1 className={styles.cardTitle}>Create account</h1>
      <SignUpForm />
    </AuthLayout>
  );
}
```

- [ ] **Step 3: Update hero nav link**

In `apps/web/src/components/hero.tsx`, change:
```tsx
<Link href="/dashboard" className={styles.navSignIn}>
```
to:
```tsx
<Link href="/sign-in" className={styles.navSignIn}>
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20 || echo "clean"
```

Expected: `clean` (or only the pre-existing polar.ts error unrelated to auth pages)

- [ ] **Step 5: Visual verification — start dev server**

```bash
bun dev:web
```

Then open:
- `http://localhost:3000/sign-in` — should show Creation of Adam background, frosted card with "Welcome back", email/password fields, gold Sign In button, "No account? Sign up" link
- `http://localhost:3000/sign-up` — same background, card with "Create account", name/email/password fields
- `http://localhost:3000` → click "Sign in" in nav → should land on `/sign-in`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/sign-in/page.tsx apps/web/src/app/sign-up/page.tsx apps/web/src/components/hero.tsx
git commit -m "feat: add /sign-in and /sign-up pages with Creation of Adam background"
```
