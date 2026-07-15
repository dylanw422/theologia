# Home Tradition at Signup — Design

**Date:** 2026-07-15
**Status:** Approved
**Closes:** docs/IMPROVE_UX.md Tier 1 #1 ("A home tradition, chosen once") — signup + edit portion. Mode-switch carrying the framework forward (the other half of #1) is explicitly out of scope; tracked separately.

## Scope

A required tradition dropdown on the signup form. The choice is saved as the user's default and pre-fills the `framework` field of every new conversation's setup, so users stop re-selecting their tradition every study. Per-conversation override via the existing `SetupPicker` is untouched — picking a different tradition for one conversation never changes the saved default. The default is editable later on `/profile`.

Out of scope: sub-tradition capture at signup (top-level framework only — sub-tradition remains a per-conversation refinement); the `ChatEmpty.handleModeChange` reset bug; onboarding flows beyond the signup form itself.

## Data model

New table in `packages/backend/convex/schema.ts`, following the existing per-user-singleton pattern (`profileSettings`, `usageWeeks`):

```ts
userPreferences: defineTable({
  userId: v.string(),
  defaultFramework: v.string(), // Framework.id from lib/studyData.ts FRAMEWORKS
}).index("by_user", ["userId"]),
```

A new table rather than a field on `profileSettings`: `profileSettings` is specifically Theological Profile opt-in/pause bookkeeping (a different feature with its own lifecycle); conflating the two would make both harder to reason about. No row exists for a user until they set a default (at signup, going forward) — absence means "no default," matching the row-absence-as-signal pattern already used by `hasProfileDecision`.

## Backend

New file `packages/backend/convex/userPreferences.ts`:

- `getDefaultFramework` (query, no args) → `string | null`. Returns the authed user's `defaultFramework`, or `null` if unauthenticated or no row exists.
- `setDefaultFramework` (mutation, `{ framework: v.string() }`) → validates `framework` is a known `Framework.id` (reject otherwise), then upserts the caller's `userPreferences` row (create if absent, patch if present). Requires auth.

Both live under the authed-user pattern already established in `profile.ts` (`ctx.auth.getUserIdentity()`).

## Web

**Signup (`apps/web/src/components/sign-up-form.tsx`)**
- Add a `tradition` field to the form's `defaultValues` and Zod schema (`z.string().min(1, "Choose a tradition")`), rendered as a `<select>` populated from `FRAMEWORKS` (imported from `lib/frameworks.ts`), matching the existing field markup pattern (label, input, error).
- On `onSuccess` of `authClient.signUp.email`, call `setDefaultFramework({ framework: value.tradition })` before redirecting to `/chat`. If the mutation fails, still redirect (account creation succeeded) but toast a warning — the user can set their default later on `/profile`; signup must not fail because of a preference write.

**Chat pre-fill (`apps/web/src/components/chat/chat-empty.tsx`)**
- When a new conversation's `ConversationSetup` is initialized, read `getDefaultFramework`. If present and the current setup has no `framework` set yet, pre-fill it. This only affects the *initial* value — once a conversation exists, `SetupPicker` edits are conversation-local as today.
- Existing users with no `userPreferences` row see today's empty-setup behavior, unchanged.

**Edit surface (`apps/web/src/components/profile/profile-page.tsx`)**
- The existing Controls row (Pause/Export/Delete) only renders for paid users who have opted into the Theological Profile feature (`!isFree && profile.optedIn`) — free users see `LockedPreview`, undecided paid users see `OptInCard`. The default tradition is unrelated to that opt-in or plan tier, so it cannot live inside that gate.
- Add a "Default tradition" control in the page header (`<header className={styles.header}>`, after the `lede` paragraph), outside the `isFree` / `optedIn` branching, so it renders for every authenticated user. A `<select>` bound to `getDefaultFramework` / `setDefaultFramework`, following the same immediate-save-on-change pattern as the Pause checkbox.

## Error handling

- `setDefaultFramework` rejects unknown framework ids (defends against stale client code referencing a removed `FRAMEWORKS` entry).
- Signup: preference-save failure is non-fatal (toast, not a blocked signup) — captured above.
- `/profile` edit: mutation failure shows an error toast and leaves the control interactive (same lesson as the tensions UI, per the opt-in touchpoint precedent).

## Testing

- convex-test: `setDefaultFramework` — creates a row when absent, patches when present, rejects an unknown framework id; `getDefaultFramework` — `null` when no row / unauthenticated, correct value once set.
- Web: signup form — submitting without a tradition selected is blocked by validation; successful signup calls `setDefaultFramework` with the selected value. No new pure logic in chat-empty pre-fill or the profile control beyond existing untested-component precedent.

## Success criteria

- New signups cannot submit without choosing a tradition.
- A new conversation's setup starts pre-filled with the user's default tradition; changing it in `SetupPicker` for that conversation does not change the saved default.
- The default is visible and editable on `/profile`.
- Existing users (no `userPreferences` row) see unchanged, empty-setup behavior until they set a default on `/profile`.
