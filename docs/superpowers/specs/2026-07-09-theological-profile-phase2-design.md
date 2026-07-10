# Theological Profile — Phase 2 (the mirror) — Design

> Implementation design for Phase 2 of [THEOLOGICAL_PROFILE.md](../../THEOLOGICAL_PROFILE.md).
> Scope: tension detection, `tensions` store, tensions UI with Study this /
> Resolved / Dismiss, sidebar count badge, dismissal-rate monitoring.
> **No prompt injection, no followup chips, no development-over-time view** —
> those are Phase 3.
>
> Note: the parent spec gates Phase 2 rollout behind a manual review of
> extraction quality across ≥50 real conversations. Building now by explicit
> direction; the dismissal-rate monitor this phase ships is the ongoing
> quality check.

## Decisions (settled during brainstorming)

- **Trigger:** a separate background action. When an extraction pass inserts
  ≥1 claim, `recordExtraction` schedules `internal.tensions.detectTensions`
  with `runAfter(0)`. One judgment pass per conversation that yields claims —
  exactly the parent spec's cost-table granularity. Extraction (Haiku) and
  judgment (Sonnet) fail and retry independently.
- **Resolved semantics:** the user's resolution text is stored on the tension
  and rendered in a quiet "Resolved" subsection of the profile. It does NOT
  create a position row (no second write path, no locus-picking UI).
- **No backfill:** detection starts as new claims arrive. Each pass considers
  all existing positions in the relevant loci, so any active user gets full
  coverage on their next studied conversation.
- **Study this:** one click creates a Q&A conversation whose first user
  message quotes both positions and asks how they relate, auto-sent via the
  existing `createConversation`, then routes to `/chat?c=<id>`.
- **Model:** exactly `anthropic("claude-sonnet-5")` — same provider pattern
  as `chat.ts`. Sonnet, not Haiku: a false alarm is worse than a miss.

## Data model (`packages/backend/convex/schema.ts`)

### `tensions`

```
userId: string
positionAId: Id<"positions">
positionBId: Id<"positions">
description: string          // neutral, 1–2 sentences; what sits uneasily
historicalNote?: string      // how the user's tradition has handled it
salience: number             // 1–3, judge-assigned; drives "strongest first"
status: "open" | "resolved" | "dismissed"
resolution?: string          // user's own words, set when status → resolved
decidedAt?: number           // ms epoch of the resolve/dismiss decision
```

Indexes: `by_user (userId)`, `by_user_status (userId, status)`.

**One tension per position pair, ever.** The pair key is the sorted pair of
position ids; an existing tension on a pair — open, resolved, or dismissed —
blocks re-creation. Dismissed pairs never resurface.

**Cascade rules:** deleting a position deletes every tension referencing it
(wired into `deletePosition` and `deleteAllProfileData`). Excluding a
position hides — at read time — every tension referencing it, without
deleting anything (symmetry with the position soft-exclude).

## Shared pure logic (`packages/backend/convex/lib/tensions.ts`)

- **`ADJACENT_LOCI`** — static, symmetric adjacency map over the eight loci
  (tests assert symmetry). Pairs:
  - scripture-revelation ↔ theology-proper
  - theology-proper ↔ christology, pneumatology, soteriology
  - christology ↔ pneumatology, soteriology, eschatology
  - pneumatology ↔ soteriology, ecclesiology-sacraments
  - anthropology-sin ↔ soteriology
  - soteriology ↔ ecclesiology-sacraments
  - ecclesiology-sacraments ↔ eschatology
- `lociToConsider(newClaimLoci)` — the new claims' loci plus their adjacents.
- `buildTensionPrompt(positions, coveredPairs, framework?)` — positions are
  numbered; already-covered pairs are listed so the judge skips them; the
  user's framework (from the triggering conversation) contextualizes the
  historical note. Abstention-biased: "most position sets contain no real
  tension; if nothing rises to one, return empty." Output contract is strict
  JSON: `{ tensions: [{ a, b, description, historicalNote?, salience }] }`
  (a/b are position indices). The word "contradiction" is banned from the
  requested output language.
- `parseTensionResponse(raw, positionCount, coveredPairs)` — fail-closed,
  same spirit as Phase 1's extraction parser: malformed payload → `[]`;
  per-item validation drops out-of-range or equal indices, already-covered
  pairs, empty/overlong descriptions, salience outside 1–3. Cap
  `MAX_TENSIONS_PER_PASS = 3` (tension fatigue guard at the source).
- `pairKey(idA, idB)` — order-independent string key.
- `selectOpenTensions(tensions)` — top `MAX_OPEN_SURFACED = 5` by salience
  desc, then newest first.
- `buildStudyPrompt(statementA, statementB)` — the seeded first message for
  Study this ("I've affirmed two things in my study… how do these relate?").
  Neutral register, no "contradiction", no verdict language.

## Judgment pipeline (`packages/backend/convex/tensions.ts`)

1. **Scheduling.** `recordExtraction` (in `profile.ts`), after inserting
   claims: if `claims.length > 0`, `ctx.scheduler.runAfter(0,
   internal.tensions.detectTensions, { userId, claimLoci, framework })`.
2. **`detectTensions` (internalAction).** Re-checks eligibility (Scholar+,
   opted in, not paused — the user may have changed state since scheduling).
   Via internal query: loads the user's latest-per-topic, non-excluded
   positions in `lociToConsider(claimLoci)` and the pair keys of all existing
   tensions. Needs ≥2 positions to proceed. One `generateText` call with
   Sonnet 5; parse; store valid tensions via `recordTensions`
   (internalMutation), which re-checks pair uniqueness transactionally before
   each insert. Any API/parse failure detects nothing — fail closed, no
   bookkeeping to unwind.
3. **Cost.** One Sonnet call per claim-yielding conversation, input capped by
   latest-per-topic selection over at most a few loci — inside the parent
   spec's ~$0.01–0.02 estimate. No Batch API yet (same deferral as Phase 1).

## Convex API surface

- `getTensions` (query, auth-gated) — `{ open: TensionView[], resolved:
  TensionView[] }`; open capped at 5 via `selectOpenTensions`; position
  statements and source-conversation ids joined server-side; hidden if
  either position is excluded or missing; `[]`s for free/non-opted-in.
- `openCount` (query) — number of visible open tensions (0 when gated);
  feeds the sidebar badge cheaply.
- `resolveTension` (mutation) — `{ tensionId, resolution }`; ownership-
  checked; requires non-empty resolution; sets status, resolution, decidedAt.
- `dismissTension` (mutation) — `{ tensionId }`; sets status + decidedAt.
  No reopen path in Phase 2.
- `detectTensions` (internalAction), `getJudgmentContext` (internalQuery),
  `recordTensions` (internalMutation).
- `qualityStats` (internalQuery) — counts by status and the dismissal rate
  (dismissed / (resolved + dismissed)), runnable via
  `bunx convex run tensions:qualityStats`. The parent spec's >25% pull-back
  threshold is checked here; no admin UI.

## UI

**Tensions section** (`apps/web/src/components/profile/tensions-section.tsx`
+ module CSS) on `/profile`, between the controls and the loci. Hidden
entirely when there are no tensions at all. Each open-tension card, in the
manuscript register:

- both position statements quoted (Fraunces), each with a Geist Mono
  apparatus line linking to its source conversation
- the neutral description; the historical note beneath it when present,
  set off as apparatus
- three quiet actions: **Study this** / **Resolved** / **Dismiss**.
  Resolved expands an inline textarea ("In your own words, how did you
  resolve this?") with save/cancel. Dismiss flips status immediately.

Below the open cards, a quiet **Resolved** subsection: statement pair
condensed to one line each, plus the user's resolution text. Dismissed
tensions never render.

**Copy rules (unchanged from parent spec):** never "contradiction", never
scoring or grading, no implication that a tradition-approved answer exists.
A careful study partner pointing at the text.

**Sidebar badge** (`chat-sidebar.tsx`): the "Your Theology" footer link
shows a Geist Mono count (e.g. `Your Theology · 3`) when `openCount > 0`;
plain link otherwise.

**Study this flow (client-side only):** `buildStudyPrompt` (imported from
the backend lib, same cross-package pattern as `LOCI`) → existing
`api.chat.createConversation` with mode `qa` → router push to
`/chat?c=<conversationId>`. No new backend surface beyond one field:
qa mode requires a `framework` (`isSetupValid`), so `getTensions` computes a
per-tension `studyFramework` server-side — the newer position's
`frameworkAtTime`, else the older's, else the framework of the user's most
recent conversation that has one. If none resolves (only possible when every
source conversation was framework-less), the card omits the Study this
action rather than fabricating a tradition.

## Testing

Same recipe as Phase 1 (vitest; pure logic exhaustively, Convex functions
via `convex-test` `t.run` helpers; public auth shells stay thin and
untested):

- adjacency map symmetry; `lociToConsider` includes self + adjacents
- prompt builder: abstention language, covered pairs listed, framework label
  resolved, banned-word absence
- parser: malformed JSON, bad indices, self-pairs, covered pairs, salience
  bounds, description limits, `MAX_TENSIONS_PER_PASS` cap
- `selectOpenTensions` ordering and cap; `pairKey` order-independence
- `recordTensions` pair-dedupe under `convex-test`; cascade delete from
  `deletePosition` / `deleteAllProfileData`; read-time hiding of tensions
  with excluded positions; `qualityStats` arithmetic
- `recordExtraction` schedules `detectTensions` only when claims > 0

## Out of scope (Phase 3)

Profile summary generation and prompt injection, tension followup chips in
chat, development-over-time view, Batch API, reopen/undo for decided
tensions, any admin dashboard for quality stats.
