# Beta Access — Design

**Date:** 2026-07-16
**Status:** Approved (pending spec review)

## Problem

The site ships behind a waitlist wall. `NEXT_PUBLIC_SITE_LIVE` (build-time
constant in `apps/web/src/lib/site-live.ts`) gates three things:

- `apps/web/src/proxy.ts` — Next 16's renamed middleware; redirects every
  route except `/` back to home when the site isn't live.
- `apps/web/src/components/hero.tsx` — hides the sign-in link, makes pricing
  cards display-only, and skips the `getCurrentUser` / products queries.
- `apps/web/src/components/not-found.tsx` — same auth-aware CTA gating.

We want to grant specific people (a subset of the existing `waitlist`) full
access to the live site while `SITE_LIVE` stays `false`, without opening the
site to the public.

## Core constraint

The middleware runs at the edge **before** authentication and redirects
`/sign-in` to `/`. So a beta user cannot authenticate first — the door has to
open **before** any login. The mechanism therefore cannot depend on an
existing session; it must establish access on its own.

## Approach: per-user magic link → signed "beta pass" cookie

Each approved beta user gets a **personal magic link** carrying a random,
non-guessable token. Visiting it mints a **signed cookie** that the middleware
trusts. From then on the middleware treats the request as if the site were
live. Real functionality (chat, profile, checkout) still sits behind
better-auth's normal login — the cookie only opens the wall.

Rejected alternatives:

- **Email-only allowlist:** emails are enumerable/guessable; anyone who finds
  `/beta` and types an approved address gets in. Defeats a closed beta.
- **One shared password:** a single leakable secret; can't revoke one person.
- **Per-user emailed password:** rebuilds credential storage/verification to
  guard the door to better-auth, which already owns real per-user credentials.
  A per-user token delivered as a link gets the same "not shared, revocable,
  not enumerable" properties with none of that machinery.

The token **is** the personal secret — delivered as a click, checked against
Convex once, then carried by the signed cookie so the middleware never calls
Convex on the hot path.

## Components

### 1. Convex data model & functions (`packages/backend/convex`)

**Schema** (`schema.ts`) — extend the existing `waitlist` table:

```ts
waitlist: defineTable({
  email: v.string(),
  betaApproved: v.optional(v.boolean()),
  betaToken: v.optional(v.string()), // random per-user token; reusable
}).index("by_email", ["email"])
  .index("by_token", ["betaToken"]),
```

**`waitlist.ts`:**

- `internalMutation setBetaToken({ email }) → { email, url }` — normalize the
  email, upsert the `waitlist` row (create if missing), generate a random
  128-bit token (`crypto.getRandomValues` → hex), set `betaApproved: true` and
  `betaToken`. Returns the full magic-link URL
  `${SITE_URL}/api/beta?token=<token>`. Reruns rotate the token.
- `internalAction approveBeta({ email }) → { url }` — calls `setBetaToken`,
  then sends the invite via Resend (see §2), returns the URL as a fallback so
  you can copy it from the dashboard if needed.
- `internalMutation revokeBeta({ email })` — clears `betaApproved` and
  `betaToken` on the row. Kills re-entry; an already-issued cookie ages out on
  its own expiry.
- `query resolveBetaToken({ token }) → { email } | null` — public but a bearer
  check: returns the row's email only when a row has that exact token **and**
  `betaApproved === true`. Used by the `/api/beta` route to validate a link.

Tokens are **reusable** (stable per user), not single-use: the same link keeps
working across the 30-day cookie's renewals and multiple devices, and email
link-scanners can't burn it. Revocation is the off switch.

`SITE_URL` already exists in the Convex env (`auth.ts` reads it).

### 2. Resend auto-send (`packages/backend/convex`)

`approveBeta` sends the invite email from a Convex `internalAction` via a
direct `fetch` to `https://api.resend.com/emails` (no new Convex component
needed) using `process.env.RESEND_API_KEY`.

- From: `Theologia <beta@theologia.app>` (domain verified in Resend via DNS).
- To: the approved email.
- Body: short branded HTML + plaintext with the personal magic link and a note
  that it's tied to their address.

If the Resend call fails, `approveBeta` still returns the URL (token is already
persisted), so you can deliver it manually — email is a convenience layer, not
the source of truth.

**Convex env vars (set via `npx convex env set`):** `RESEND_API_KEY`.
`SITE_URL` already present.

### 3. `/beta` page + `/api/beta` route (`apps/web/src/app`)

**`/api/beta` route handler** (`src/app/api/beta/route.ts`) — GET, is the
magic-link target. Under `api/`, so already excluded from the middleware
matcher (always reachable):

1. Read `token` from the query string.
2. Call Convex `resolveBetaToken({ token })` (server-side via
   `NEXT_PUBLIC_CONVEX_URL`).
3. On match: set two cookies, then 302 → `/sign-in`.
   - `beta_pass` — **HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30d.**
     Value = `base64url(payload) + "." + base64url(HMAC-SHA256(payload,
     BETA_SECRET))`, where `payload = "<email>:<expiryMs>"`. The signature is
     the security gate. Signed/verified with Web Crypto (edge-compatible).
   - `beta_ui` — value `"1"`, **not HttpOnly**, Secure, SameSite=Lax, same
     Max-Age. Cosmetic only, so client components can flip their UI.
4. On no match / missing token: 302 → `/beta?error=invalid`.

Cookies are set in the route handler (not during page render, where Next
forbids `cookies().set`).

**`/beta` page** (`src/app/beta/page.tsx`) — a branded, hero-styled landing:

- Default: brief "Enter through your personal invite link" copy (no email
  form, no password field — entry is the link).
- `?error=invalid`: "This invite link is invalid or has been revoked —
  reach out and we'll sort it." No token detail leaked.

The middleware must let `/beta` through (see §4).

**Cookie signing helper** (`src/lib/beta-pass.ts`) — `signBetaPass(email)` and
`verifyBetaPass(cookieValue)` using Web Crypto HMAC-SHA256 with `BETA_SECRET`.
Shared by the route handler and the middleware; both run at the edge, so no
Node-only crypto.

### 4. Middleware (`apps/web/src/proxy.ts`)

Replace the single `SITE_LIVE` check:

```ts
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/beta") return NextResponse.next();     // unlock page
  if (SITE_LIVE || await hasValidBetaPass(request)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/", request.url));
}
```

`hasValidBetaPass` reads the `beta_pass` cookie, recomputes the HMAC over the
payload, compares signatures, and checks `expiryMs > Date.now()`. **No Convex
call** — the edge stays fast. Matcher is unchanged (`/api/beta` already
excluded via the `api/` carve-out).

### 5. Client UI runtime access

Client components currently branch on the build-time `SITE_LIVE`. Introduce a
runtime signal so beta users see the live UI:

- `src/lib/site-live.ts` (or a small `use-site-access.ts`): add
  `useSiteAccess(): boolean` returning `SITE_LIVE || hasBetaUiCookie()`, where
  `hasBetaUiCookie` reads `document.cookie` for `beta_ui=1`. Read after mount
  (`useState` + `useEffect`) to avoid a hydration mismatch — accept a brief
  non-beta flash on first paint.
- `hero.tsx`: replace the `SITE_LIVE` uses that control the sign-in link, the
  pricing links/checkout, and the `getCurrentUser` / `getConfiguredProducts`
  query `"skip"` guards with `useSiteAccess()`.
- `not-found.tsx`: same swap for its `getCurrentUser` guard and `signedIn`.

`SITE_LIVE` stays as the "globally live" constant; `useSiteAccess()` is
"this visitor may see the live site."

### 6. Config / env

- **Vercel (Next.js) env:** `BETA_SECRET` — server-only (not `NEXT_PUBLIC_`),
  random high-entropy string; signs/verifies `beta_pass`. Add to the server
  section of `packages/env/src/web.ts`.
- **Convex env:** `RESEND_API_KEY`. `SITE_URL` already set.
- **DNS:** verify `theologia.app` in Resend (SPF/DKIM records) so mail from
  `beta@theologia.app` delivers. (Free tier: 3,000/mo, 100/day — ample.)

## Admin & lifecycle

- **Approve someone:** Convex dashboard → run `approveBeta({ email })`. They
  get the email automatically; the returned URL is a copy-paste fallback. No
  redeploy.
- **Revoke:** `revokeBeta({ email })`. Re-entry stops immediately; their cookie
  lapses within 30 days.
- **Rotate the signing secret** (if `BETA_SECRET` ever leaks): change the
  Vercel env var and redeploy — all outstanding `beta_pass` cookies become
  invalid at once. Users re-click their (still valid) links to re-enter.
- **Go fully live:** set `NEXT_PUBLIC_SITE_LIVE=true`; beta plumbing becomes a
  no-op path and can be removed later.

## Security considerations

- The `beta_pass` cookie only opens the wall. Chat/profile/checkout still
  require a real better-auth session; usage is bounded by Polar tier limits.
- Tokens are 128-bit random — not enumerable like emails.
- `resolveBetaToken` is a bearer check (must present the exact token) and only
  returns an email for an actively-approved row; it exposes nothing without the
  secret token.
- `beta_pass` is HttpOnly + signed, so it can't be read or forged client-side.
  `beta_ui` is deliberately non-sensitive (a UI hint); forging it only changes
  local rendering, not middleware access.
- GET magic links are safe to prefetch/scan because tokens are reusable —
  scanning sets a harmless cookie in the scanner and doesn't consume anything.

## Testing

- `beta-pass.ts`: unit tests for sign/verify round-trip, tampered signature
  rejection, and expiry rejection.
- `waitlist.ts`: convex-test coverage for `setBetaToken` (upsert + token set),
  `resolveBetaToken` (match only when approved; null on revoked/unknown), and
  `revokeBeta` (clears fields). Follows the existing `*.test.ts` pattern.
- Manual: approve a test email → receive/inspect link → click → land on
  `/sign-in` with cookies set → reach `/chat` while `SITE_LIVE` is unset →
  revoke → new clicks land on `/beta?error=invalid`.

## Out of scope (YAGNI)

- Self-serve email/password entry form on `/beta` (entry is the link).
- Single-use tokens / per-click expiry.
- An in-app admin UI for approvals (Convex dashboard is enough for a beta).
- Bulk import / CSV of beta users.
