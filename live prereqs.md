# Live Prereqs

Launch-readiness review of the web app (2026-07-16). Ordered by priority.

## Fix before going live

### 1. Commit the mobile drawer work
`chat-app.tsx`, `chat-app.module.css`, and `chat-thread.module.css` are
uncommitted in the working tree, and deploys go straight from master.

### 2. Waitlist mutation accepts anything — DONE
`packages/backend/convex/waitlist.ts` — `join` did no server-side
validation or normalization:

- `Foo@Bar.com` and `foo@bar.com` became two rows.
- Convex mutations are publicly callable, so anyone could script junk rows
  into the table (the client-side regex protected nothing).

Fixed: `join` and `isRegistered` now trim + lowercase + validate format
server-side before touching the database. Rate limiting is still
nice-to-have but not done.

### 3. Waitlist gate is UI-only
The proxy (`apps/web/src/proxy.ts`) excludes `/api`, so the better-auth
endpoints under `/api/auth/*` accept sign-ups even with `SITE_LIVE`
unset — someone could create an account via direct POST and use the free
chat tier.

- If launching waitlist-only: gate sign-up server-side (check `SITE_LIVE`
  in the auth route handler).
- If "going live" means flipping `SITE_LIVE=true`: moot.

### 4. No custom 404 / error pages — 404 DONE, error.tsx still open
`not-found.tsx` is now a custom on-brand ink/parchment/gold page
(`apps/web/src/app/not-found.tsx` + `src/components/not-found.tsx`), with
a CTA that routes signed-in users to `/chat` and everyone else home. See
`docs/superpowers/specs/2026-07-16-not-found-page-design.md`.

Still missing: `error.tsx` / `global-error.tsx` for unhandled exceptions
(a distinct concern from 404s — different trigger, different recovery
semantics). Client-component crashes still hit Next's stark default.

## Worth doing, not blocking

### 5. No robots.txt or sitemap — DONE
Added `apps/web/src/app/robots.ts` and `sitemap.ts`. Robots disallows the
private app views (`/chat`, `/profile`, `/sign-in`, `/sign-up`, `/api/`)
and points at the sitemap; the sitemap lists just the public marketing
page (`/`). Also extracted the Vercel-domain `siteUrl` logic out of
`layout.tsx` into `src/lib/site-url.ts` since three files now need it.

### 6. Stray files in `public/` are publicly served
None of these are referenced anywhere in `src/`:

- `ChatGPT Image Jun 30, 2026, 07_03_21 PM.png` (2.9 MB — the filename
  would look bad if someone found it)
- `cfcaa52839248955540e79543b046659.jpg`
- `photo-1768296100606-72e7ff614831.avif` (780 KB)
- `baroque-clouds.jpg` (684 KB)

Delete them.

### 7. No analytics
No visibility into traffic or waitlist conversion on launch day.
Vercel Analytics is a two-line add if wanted.

### 8. Hero image weight
`school-of-athens.jpg` is 1.4 MB loaded as a CSS background (no
`next/image` optimization) — it's the mobile LCP. Compressing to a
~300 KB AVIF/WebP would meaningfully speed first paint.

### 9. Email enumeration (minor)
`waitlist.isRegistered` lets anyone probe whether an email is on the
waitlist. The "Already registered" pre-check is the leak — could just
submit and show success either way, since `join` already dedupes
silently.

## Loose ends (not launch blockers)

- Profile-feature smoke tests still pending.
- `next@16.2.10` upgrade for the dev-server OOM (dev-only).
