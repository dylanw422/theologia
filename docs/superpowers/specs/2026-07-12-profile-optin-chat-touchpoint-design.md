# Profile Opt-In Chat Touchpoint Design

**Date:** 2026-07-12
**Status:** Approved
**Closes:** docs/THEOLOGICAL_PROFILE.md §User control — "Explicit opt-in at first eligible conversation" (currently the opt-in only exists on /profile)
**Companion:** [Phase 3 design](./2026-07-12-theological-profile-phase3-design.md)

## Scope

A quiet, dismissible opt-in card in the chat pane for paid users who have never made a profile decision. Both actions record a real decision through the existing `setOptIn` mutation. No schema changes, no new mutations.

Out of scope: modals, toasts about the profile, re-prompting users who declined (the /profile OptInCard remains the place to change one's mind), free-tier surfaces.

## Eligibility

Show the card when BOTH:
- `usage.getUsage().planId !== "free"` (client-side gate, same pattern as `ChatUpgradeBanner`)
- the user has no `profileSettings` row — a row is created by `upsertSettings` on any decision, so row-absence exactly means "never decided"

## Backend

One new public query in `packages/backend/convex/profile.ts`:

- `hasProfileDecision` (no args) → `boolean`. Returns `true` when a `profileSettings` row exists for the authed user, and `true` when unauthenticated — the card only ever shows on an affirmative `false`, so every doubt path hides it. No plan logic in the query (polar isn't loadable under convex-test; the plan gate lives client-side on the already-fetched `getUsage`).

## Web

New component `apps/web/src/components/chat/profile-optin-card.tsx` + `profile-optin-card.module.css`, mirroring the `chat-upgrade-banner` file pattern. Rendered from `chat-app.tsx` inside the content column, above `LiveThread` / `ChatEmpty`, so it flows with the page rather than overlaying it.

Render nothing until both queries resolve; render nothing unless `planId !== "free" && hasProfileDecision === false`.

**Copy (condensed from /profile's OptInCard; manuscript register, never the word "contradiction"):**
- Title: "Keep a record of what you believe?"
- Body: with permission, Theologia records the positions the user affirms in their own words — one sentence each, linked to its conversation; answers draw on them so studies build on each other; everything is editable, exportable, deletable; never shared, never used in marketing, never used to train models.
- "Learn more" link to `/profile`.

**Actions:**
- **Begin my profile** → `setOptIn({ optedIn: true })`, success toast ("Your profile has begun — see Your Theology."), card disappears.
- **Not now** → `setOptIn({ optedIn: false })`, card disappears silently.

Both mutation calls surface failures with an error toast (never freeze or silently drop — same lesson as the tensions UI).

## Dismissal semantics

"Not now" is a **recorded decision** (`optedIn: false`, `decidedAt` set), not a session dismiss. The card never reappears; `/profile`'s OptInCard remains the way to opt in later. Consent clarity over adoption pressure.

## Testing

- convex-test: `hasProfileDecision` semantics — no row → prompt-eligible; row after `upsertSettings` (either decision) → not eligible. Tested via the exported query where auth allows, else via `settingsForUser` helper pattern established in `profile.test.ts`.
- Web: no new pure logic; component follows existing untested-banner precedent (`ChatUpgradeBanner`).

## Success criteria

- Undecided paid user sees the card in chat; either action makes it disappear permanently across sessions.
- Decided users (either way), free users, and signed-out users never see it.
- A mutation failure shows an error toast and leaves the card interactive.
