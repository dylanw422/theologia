# Not Found (404) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Next's default 404 with a custom, on-brand not-found page for the Theologia web app.

**Architecture:** A thin Server Component at the Next.js special-file location (`app/not-found.tsx`) exports `metadata` and renders a Client Component (`components/not-found.tsx`) that holds the actual UI and an auth-aware CTA (Convex `useQuery` requires `"use client"`, which is incompatible with exporting `metadata` from the same file).

**Tech Stack:** Next.js App Router, React, Convex (`convex/react` `useQuery`), CSS Modules.

## Global Constraints

- No fresco/photo background — ink-deep canvas + grain texture + radial gold glow only.
- Copy is fixed by the spec (see Task 1, Step 2) — do not paraphrase.
- CSS module is fully self-contained: redeclare `--ink-deep`, `--parchment`, `--parchment-dim`, `--gold`, `--gold-bright`, `--hairline` locally rather than importing them from another module (matches existing convention in `hero.module.css` / `auth-layout.module.css`).
- Auth logic: `useQuery(api.auth.getCurrentUser, SITE_LIVE ? undefined : "skip")`, CTA is `/chat` only when `SITE_LIVE && !!user`, otherwise `/`. This exact pattern is copied from `apps/web/src/components/hero.tsx`.
- `robots: { index: false }` on the page's metadata — a 404 must never be indexed.
- Entrance animation must respect `prefers-reduced-motion: reduce` (disable animation, show content at full opacity).
- No new test framework/pattern: this repo has no existing React component test setup in `apps/web` (only Convex backend tests via `convex-test`). Verification is via `tsc --noEmit` plus manual `curl` checks against the running dev server, matching how the mobile-drawer and waitlist-validation changes earlier this session were verified.

---

### Task 1: Build the custom 404 page

**Files:**
- Create: `apps/web/src/components/not-found.module.css`
- Create: `apps/web/src/components/not-found.tsx`
- Create: `apps/web/src/app/not-found.tsx`

**Interfaces:**
- Consumes: `SITE_LIVE` from `@/lib/site-live` (existing, `apps/web/src/lib/site-live.ts`); `api.auth.getCurrentUser` from `@theologia/backend/convex/_generated/api` (existing, already used by `hero.tsx`); `useQuery` from `convex/react`.
- Produces: default export `NotFound` (client component, `apps/web/src/components/not-found.tsx`) and default export `NotFoundPage` (server component, `apps/web/src/app/not-found.tsx`) — nothing later depends on these beyond Next's own routing convention (it discovers `app/not-found.tsx` by file name).

- [ ] **Step 1: Create the CSS module**

Create `apps/web/src/components/not-found.module.css`:

```css
.root {
  --ink-deep: #0b0805;
  --parchment: #f1e8d6;
  --parchment-dim: #b9a886;
  --gold: #c9a24e;
  --gold-bright: #e6c984;

  position: relative;
  isolation: isolate;
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ink-deep);
  color: var(--parchment);
  font-family: var(--font-inter), system-ui, sans-serif;
  text-align: center;
  padding: clamp(1.5rem, 6vw, 4rem);
}

.glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    60% 50% at 50% 42%,
    rgba(201, 162, 78, 0.16) 0%,
    rgba(201, 162, 78, 0.05) 45%,
    rgba(11, 8, 5, 0) 75%
  );
}

.grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 46ch;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: clamp(1.1rem, 2.4vw, 1.7rem);
}
.eyebrow::before {
  content: "";
  display: inline-block;
  width: 2.2rem;
  height: 1px;
  margin-right: 0.9rem;
  vertical-align: middle;
  background: var(--gold);
  opacity: 0.7;
}

.headline {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 370;
  font-size: clamp(2.2rem, 5.4vw, 3.6rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--parchment);
  text-wrap: balance;
}
.headline em {
  font-style: italic;
  font-weight: 400;
  color: var(--gold-bright);
}

.lede {
  margin-top: clamp(1.1rem, 2.4vw, 1.6rem);
  font-size: clamp(0.95rem, 1.2vw, 1.05rem);
  line-height: 1.6;
  color: var(--parchment-dim);
}

.cta {
  margin-top: clamp(1.9rem, 3.4vw, 2.6rem);
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--gold);
  color: #1a1206;
  font-weight: 600;
  font-size: 0.98rem;
  padding: 0.95rem 1.65rem;
  border: 1px solid var(--gold);
  border-radius: 2px;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease;
}
.cta:hover {
  background: var(--gold-bright);
  border-color: var(--gold-bright);
  transform: translateY(-1px);
  box-shadow: 0 14px 34px -14px rgba(201, 162, 78, 0.6);
}
.cta:focus-visible {
  outline: 1px solid var(--gold-bright);
  outline-offset: 2px;
}
.cta .arrow {
  transition: transform 0.22s ease;
}
.cta:hover .arrow {
  transform: translateX(3px);
}

.reveal {
  opacity: 0;
  transform: translateY(18px);
  animation: rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}
.d1 {
  animation-delay: 0.05s;
}
.d2 {
  animation-delay: 0.16s;
}
.d3 {
  animation-delay: 0.28s;
}

@keyframes rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
```

- [ ] **Step 2: Create the client component**

Create `apps/web/src/components/not-found.tsx`:

```tsx
"use client";

import Link from "next/link";

import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import { SITE_LIVE } from "@/lib/site-live";
import styles from "./not-found.module.css";

export default function NotFound() {
  const user = useQuery(
    api.auth.getCurrentUser,
    SITE_LIVE ? undefined : "skip",
  );
  const signedIn = SITE_LIVE && !!user;
  const ctaHref = signedIn ? "/chat" : "/";
  const ctaLabel = signedIn
    ? "Return to your studies"
    : "Back to the beginning";

  return (
    <div className={styles.root}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.grain} aria-hidden />
      <div className={styles.content}>
        <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
          § 404
        </p>
        <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
          This page has been declared <em>apocryphal</em>.
        </h1>
        <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
          No manuscript survives at this address. The page you&rsquo;re
          looking for doesn&rsquo;t exist — or never made it into the canon.
        </p>
        <Link
          href={ctaHref}
          className={`${styles.cta} ${styles.reveal} ${styles.d3}`}
        >
          {ctaLabel}
          <span className={styles.arrow} aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the server-component wrapper**

Create `apps/web/src/app/not-found.tsx`:

```tsx
import type { Metadata } from "next";

import NotFound from "@/components/not-found";

export const metadata: Metadata = {
  title: "Page not found — Theologia",
  robots: { index: false },
};

export default function NotFoundPage() {
  return <NotFound />;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0, no errors.

- [ ] **Step 5: Verify existing redirect behavior is unchanged**

With the dev server running on port 3001 and `NEXT_PUBLIC_SITE_LIVE` unset
(waitlist mode, the default in this environment), a normal unmatched route
(no dot in the path) must still bounce to `/` via the proxy — confirming
this change didn't alter existing routing.

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3001/this-route-does-not-exist"`
Expected: `307 ` (or `308`) with a redirect location of `/` (or a final
`200` if curl follows the redirect — either way, response must not be the
new 404 content). If unsure, run with `-D -` to inspect headers directly
instead of relying on curl's own redirect handling.

- [ ] **Step 6: Verify the new 404 page renders**

The proxy's matcher excludes any path containing a dot, so a dotted,
nonexistent path bypasses the waitlist redirect and reaches Next's router,
which serves `not-found.tsx`. This is the only way to exercise the new
page while `SITE_LIVE` is off.

Run: `curl -s "http://localhost:3001/this-page-does-not-exist.foo" --max-time 15`
Expected: HTTP 200 (Next renders 404 pages with a 200/404 status
depending on config, either is fine) with the response body containing:
- `This page has been declared` (the headline text)
- `Back to the beginning` (the signed-out CTA label, since `SITE_LIVE` is
  off in this environment)
- `<title>Page not found — Theologia</title>`
- `name="robots" content="noindex"` (or equivalent noindex directive)

Confirm with: `curl -s "http://localhost:3001/this-page-does-not-exist.foo" --max-time 15 | grep -o "This page has been declared\|Back to the beginning\|noindex"`

- [ ] **Step 7: Verify the responsive CSS compiled**

No browser/screenshot tool is available in this session, so a true visual
mobile check isn't possible here — flag that to the user as a follow-up.
As a proxy, confirm the compiled CSS chunk actually contains the
`clamp()`-based responsive rules (i.e. the build didn't drop or mangle
them):

Run:
```bash
CSS_HREF=$(curl -s "http://localhost:3001/this-page-does-not-exist.foo" --max-time 15 | grep -o 'href="[^"]*not-found[^"]*\.css[^"]*"' | sed 's/href="//;s/"$//' | head -1)
curl -s "http://localhost:3001${CSS_HREF}" --max-time 10 | grep -c "clamp("
```
Expected: a nonzero count (the headline/lede/eyebrow/cta/padding rules all
use `clamp()`).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/not-found.tsx apps/web/src/components/not-found.module.css apps/web/src/app/not-found.tsx
git commit -m "$(cat <<'EOF'
feat(web): add custom 404 page

Replaces Next's default not-found page with an on-brand ink/parchment/gold
page, with a CTA that routes signed-in users back to /chat and everyone
else home.
EOF
)"
```
