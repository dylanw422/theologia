# Not Found (404) Page Design

**Date:** 2026-07-16
**Status:** Approved

## Problem

The app has no custom 404 handling — `apps/web/src/app/` has no `not-found.tsx`,
so unmatched routes fall through to Next's stark default page, which clashes
with the ink-dark/parchment/gold brand used everywhere else (hero, auth
pages, chat app).

Note: while `NEXT_PUBLIC_SITE_LIVE` is unset, `apps/web/src/proxy.ts`
redirects almost all unmatched routes to `/` before Next's routing ever
sees them, so this page mostly won't render until the site goes live. The
one exception is any path containing a dot (`.`) that isn't a real static
asset — the proxy's matcher excludes those, so they do reach Next's router
and can hit `not-found.tsx` even in waitlist mode.

## Decisions

- **No fresco image.** Unlike the hero/auth/chat surfaces, this page uses
  only the shared ink-deep/parchment/gold color tokens plus the grain
  texture and a radial gold-tinted glow — no photograph. An error page
  should load instantly and not imply a full marketing moment.
- **Copy tone: scholarly wit, one CTA.** A theology-flavored joke
  ("apocryphal") rather than generic "page not found" copy, consistent
  with the confident, literate voice used elsewhere on the site.
- **CTA is auth-aware.** Signed-in users (once the site is live) get
  routed back into their studies (`/chat`) instead of the marketing page
  they've already passed; everyone else goes home (`/`).

## Architecture

Next.js requires `not-found.tsx` to be a special file directly under
`app/`, and it must be able to export `metadata`. Metadata exports are not
allowed in Client Components, but the auth-aware CTA needs a Convex hook
(`useQuery`), which requires `"use client"`. So the page is split the same
way the rest of this codebase splits routes from presentation:

- **`apps/web/src/app/not-found.tsx`** — Server Component (default, no
  `"use client"`). Exports `metadata` (title + `robots: { index: false }`
  so the error page is never indexed) and renders `<NotFound />`.
- **`apps/web/src/components/not-found.tsx`** — Client Component with the
  actual UI and auth logic. Same shape as `hero.tsx`: a default export,
  `"use client"` at the top, imports its own CSS module.
- **`apps/web/src/components/not-found.module.css`** — self-contained
  styles. Following the existing convention (see `hero.module.css`,
  `auth-layout.module.css`), it redefines its own copy of the shared
  color custom properties (`--ink-deep`, `--parchment`, `--parchment-dim`,
  `--gold`, `--gold-bright`, `--hairline`) and its own `@keyframes` for the
  entrance animation, rather than importing shared state from another
  module. This repo intentionally keeps CSS modules standalone.

### Auth-aware CTA

Mirrors the pattern already used in `hero.tsx` for `user`/`SITE_LIVE`
rather than introducing a new one:

```tsx
const user = useQuery(api.auth.getCurrentUser, SITE_LIVE ? undefined : "skip");
const signedIn = SITE_LIVE && !!user;
const ctaHref = signedIn ? "/chat" : "/";
const ctaLabel = signedIn ? "Return to your studies" : "Back to the beginning";
```

- While `SITE_LIVE` is false, the query is skipped entirely (matches
  `hero.tsx`) and the CTA always points home — correct, since `/chat` is
  itself proxy-redirected to `/` in waitlist mode anyway.
- While the query is loading (`user === undefined` but not skipped), the
  CTA renders as if signed out (home). It swaps to `/chat` once the query
  resolves to a user document. This is the same tradeoff already accepted
  by the pricing cards in `hero.tsx` (no separate loading skeleton for a
  single link swap) and avoids adding a distinct loading state for what's
  a low-stakes, rarely-lingered-on page.

## Visual Design

Full-viewport (`min-height: 100svh`), centered column, no fresco:

- **Background:** `var(--ink-deep)` solid, plus the same low-opacity
  film-grain texture used elsewhere (`mix-blend-mode: overlay`,
  `opacity: 0.06`), plus a soft `radial-gradient` glow in a dim gold tone
  centered behind the text block for atmosphere without a photo.
- **Eyebrow:** mono, gold, uppercase, echoing the hero's citation-chip
  style: `§ 404`
- **Headline:** Fraunces serif, matching `.headline` treatment elsewhere —
  *"This page has been declared *apocryphal*."* — with "apocryphal"
  italicized in `--gold-bright`, matching the `<em>` treatment used in the
  hero headline.
- **Lede:** parchment-dim, one to two sentences —
  *"No manuscript survives at this address. The page you're looking for
  doesn't exist — or never made it into the canon."*
- **CTA:** reuses the hero's `.btnPrimary` visual treatment (solid gold
  button, dark text, trailing arrow that nudges right on hover) — not a
  shared class (per the standalone-CSS-module convention above), but the
  same look, redeclared in `not-found.module.css`.

### Motion

Same staggered fade-up entrance pattern as the hero (`.reveal` + `.d1`
through `.d3`-equivalent delays), respecting
`@media (prefers-reduced-motion: reduce)` by disabling the animation and
showing content at full opacity immediately — matching the hero's
existing accessibility handling.

## Responsive

Single column at all widths; no grid to collapse. At small viewports,
reduce the headline/lede font sizes and horizontal padding using the same
`clamp()` approach already used throughout `hero.module.css`, rather than
a distinct `@media (max-width: 760px)` breakpoint block. No breakpoint
divergence in layout is expected since the page never had a multi-column
structure to begin with.

## Testing / Verification

- `tsc --noEmit` across the web app (existing check already run for prior
  chat/waitlist changes).
- Manually hit an unmatched route on the running dev server (e.g.
  `/this-does-not-exist`) and confirm the custom page renders instead of
  Next's default, in both `SITE_LIVE` on and off (toggle the env var
  locally) to confirm the redirect-vs-render split behaves as described
  above.
- Visually confirm on a mobile viewport width, since prior work this
  session (hero scroll bug, chat drawer) was mobile-specific and this page
  should hold up there too.

## Out of Scope

- A custom `error.tsx` / `global-error.tsx` for unhandled exceptions is a
  separate, distinct concern (different trigger, different recovery
  semantics) and is not part of this design.
- No sitemap/robots.txt changes beyond this page's own `noindex` — those
  are tracked separately in `live prereqs.md`.
