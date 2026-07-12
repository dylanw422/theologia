# Theological Profile — Phase 3 ("The Companion") Design

**Date:** 2026-07-12
**Status:** Approved
**Spec:** [docs/THEOLOGICAL_PROFILE.md](../../THEOLOGICAL_PROFILE.md) §Rollout Phase 3
**Predecessors:** [Phase 1 design](./2026-07-07-theological-profile-phase1-design.md), [Phase 2 design](./2026-07-09-theological-profile-phase2-design.md)

## Scope

Phase 3 makes the profile active inside the product instead of a page the user visits:

1. **Prompt injection** — a compact summary of the user's affirmed positions is appended to the chat system prompt, so answers build on what the user has already worked through.
2. **Tension followup chips** — when a reply bears on a stored position, the model may offer a followup chip connecting them. Pull, never push.
3. **Development-over-time view** — per-topic history on `/profile` ("your view of the atonement, March → July").

Out of scope: any new extraction or judgment pipeline work, tier changes, new pages.

## Deviation from the feature spec

THEOLOGICAL_PROFILE.md's cost table includes a "Profile summary refresh" Haiku call per extraction pass, cached on the user. This design **drops that call** in favor of deterministic assembly at reply time:

- Position statements are already one-sentence, user-voice strings — concatenating the latest-per-topic set with locus/stance/strength labels *is* the summary; Haiku would only paraphrase it.
- Assembly in an internal query is free, always fresh (edits, deletes, exclusions reflected instantly, no cache invalidation), and has no API failure mode.
- The ~600-token cap becomes an exact character truncation rather than a prompt-obeyed hope.

The injection-cost row (~$0.0002/query at cached rates) still applies; the $0.002/pass refresh row disappears.

## 1. Prompt injection

### `convex/lib/profileSummary.ts` (new, pure, tested)

- `buildProfileSummary(positions): string | null`
  - Input: position views (statement, locus, topic, stance, strength, createdAt, excluded).
  - Filters excluded; collapses to latest per topic via the existing `latestPerTopic`.
  - Orders settled → leaning → exploring; newest first within each band, so settled positions survive truncation and exploring ones fall off first.
  - One line per position: `- [Soteriology / election] Regeneration precedes faith. (affirmed, settled)`. Locus rendered with its display label. Denied stances are included — a denial is as informative as an affirmation, and the stance label carries it.
  - Hard cap `PROFILE_SUMMARY_MAX_CHARS = 2400` (~600 tokens), whole lines only.
  - Returns `null` when nothing qualifies (empty profile injects nothing — no empty section).
- `buildProfileSection(summary): string`
  - Wraps the summary in a `## The user's theological profile` block with instructions:
    - These are positions the user has affirmed in their own voice across prior study.
    - Build on them instead of re-explaining settled ground.
    - Never volunteer observations about the profile unprompted; never grade or police consistency.
    - Followup rule: when the reply bears directly on one of these positions, the reply *may* end with a `<followups>` chip connecting them (e.g. "How does this square with my view of X?"). Only when genuinely apt.

### `convex/profile.ts`

- `getPromptProfile` (internalQuery, `{ userId }` → `string | null`):
  - Returns `null` if plan is `free`, or user not opted in.
  - **Paused still injects** — pause stops extraction, not use of what's recorded (spec: "stops extraction without deleting anything").
  - Otherwise returns `buildProfileSection(buildProfileSummary(positions))`, or `null` when the summary is null.

### `convex/chat.ts`

- `streamReply` fetches the profile section inside its existing `try` and appends it to `system` after the mode section. A profile-query failure degrades to a normal un-augmented reply; it never breaks the response.
- Injected in **all modes**, including Devil's Advocate — knowing what the user actually holds makes the opponent sharper, which is that mode's job.

## 2. Tension followup chips

No new code paths. The `<followups>` tag already parses and renders as action chips end-to-end. The followup rule inside `buildProfileSection` is the entire feature: profile-aware chips appear only when the model judges a reply touches a stored position, and the user pulls by clicking.

## 3. Development-over-time view

### Backend

- `getProfile` additionally returns the full non-excluded position history (the table is append-only; today's query collapses it with `latestPerTopic` and discards the rest). Response gains a `history` array alongside the existing `positions` (latest-per-topic) so current consumers are untouched.

### Web (`/profile`)

- A topic with more than one recorded claim gets a quiet apparatus link on its position card: `development · 3 positions, Mar → Jul`.
- Expanding shows the earlier statements inline, oldest first, each with date, stance/strength, framework at the time, and source-conversation link. Manuscript register per DESIGN.md: history reads as an apparatus of prior readings, not a changelog.
- No new page, no extra query roundtrip.

## 4. Consent copy

The opt-in card and the profile lede each gain one sentence: answers in your studies will draw on your recorded positions. (The opt-in explanation must describe use, not just storage.)

## Error handling & edge cases

- Empty or fully-excluded profile → no injection at all.
- Downgraded-to-free user keeps their data; injection and extraction both stay off.
- Profile fetch failure in `streamReply` → reply proceeds without the section.
- Over-cap profiles truncate on whole-line boundaries, settled-first ordering decides survival.

## Testing

- **Pure lib (vitest):** `profileSummary` ordering (strength bands, recency), cap truncation on line boundaries, exclusion filtering, latest-per-topic collapse, null on empty; section wrapper contains the followup rule.
- **convex-test:** `getPromptProfile` gating matrix (free / not opted in / paused / opted in), `getProfile` history shape, `streamReply`-adjacent assembly covered via the internal query.
- **Web:** grouping/format helpers unit-tested; component behavior follows existing profile-page patterns.

## Success criteria

- Opted-in paid users' replies reference prior positions without re-explaining them; chips connecting to stored positions appear only when apt.
- `/profile` shows per-topic development for topics with ≥2 claims.
- No reply is ever blocked or broken by profile machinery.
