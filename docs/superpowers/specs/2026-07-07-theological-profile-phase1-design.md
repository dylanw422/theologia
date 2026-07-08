# Theological Profile — Phase 1 (the ledger) — Design

> Implementation design for Phase 1 of [THEOLOGICAL_PROFILE.md](../../THEOLOGICAL_PROFILE.md).
> Scope: opt-in flow, extraction pipeline, `positions` store, read-only `/profile`
> page with edit/delete/export controls. **No tensions, no prompt injection** —
> those are Phases 2–3, gated behind the spec's manual extraction-quality review.

## Decisions (settled during brainstorming)

- **Scope:** Phase 1 only.
- **Extraction trigger:** debounced schedule — each eligible user message cancels
  the conversation's pending extraction job and schedules a new one ~30 minutes
  out, matching the spec's idle semantics.
- **Model call:** synchronous Haiku 4.5 (`claude-haiku-4-5`) in a Convex action.
  The Batch API 50%-off lever is deferred until volume justifies the infra.
- **Delta extraction:** each pass reads only messages after a per-conversation
  high-water mark (`lastExtractedMessageId`), so positions append cleanly and
  no transcript is billed twice.
- **Opt-in surfacing:** the `/profile` page only. No in-chat prompt in Phase 1;
  a chat-side nudge makes sense once the profile feeds back into answers
  (Phase 3), not before.

## Data model (`packages/backend/convex/schema.ts`)

### `positions` (append-only)

```
userId: string
locus: one of 8 fixed slugs (see lib/profile.ts)
topic: string            // slug, e.g. "election", "baptismal-efficacy"
statement: string        // one sentence, user's voice
stance: "affirmed" | "denied" | "uncertain"
strength: "settled" | "leaning" | "exploring"
sourceConversationId: Id<"conversations">
sourceMessageId: string
frameworkAtTime: string | undefined
excluded: boolean        // user hid it from the profile (soft exclude)
userEdited: boolean      // statement hand-edited by the user
```

Indexes: `by_user (userId)`, `by_user_locus (userId, locus)`,
`by_user_topic (userId, topic)`. New claims on an existing topic append —
never overwrite — so each topic keeps a history (`_creationTime` orders it).

### `profileSettings`

```
userId: string
optedIn: boolean         // off by default; nothing extracts until true
paused: boolean          // stops extraction without deleting anything
decidedAt: number        // ms epoch of the opt-in/out decision
```

Index: `by_user (userId)`.

### `conversations` additions (all optional — no migration needed)

```
lastMessageAt?: number            // ms epoch of last user message
pendingExtractionId?: string      // scheduled-function id, for debounce cancel
lastExtractedMessageId?: string   // delta high-water mark
```

## Shared shape: `packages/backend/convex/lib/profile.ts`

The eight loci as a fixed const array (id slug + display label), mirroring the
`studyData.ts` pattern:

1. `scripture-revelation` — Scripture & Revelation
2. `theology-proper` — Theology Proper
3. `christology` — Christology
4. `pneumatology` — Pneumatology
5. `anthropology-sin` — Anthropology & Sin
6. `soteriology` — Soteriology
7. `ecclesiology-sacraments` — Ecclesiology & Sacraments
8. `eschatology` — Eschatology

Plus validators (`vLocus`, `vStance`, `vStrength`) reused by schema and
function args.

## Eligibility & tier gate

Extraction runs only when **all** hold:

- plan is Scholar or above (`getPlanIdForUser` ≠ `"free"`)
- `profileSettings.optedIn === true` and `paused === false`

Free users see `/profile` as a locked preview: the eight loci greyed out with
copy explaining what fills them in. Opted-out paid users see the opt-in card.

## Extraction pipeline (`packages/backend/convex/profile.ts` + `lib/extraction.ts`)

1. **Scheduling.** In `sendMessage` and `createConversation`, after the user
   message is saved: if the user is eligible, cancel
   `pendingExtractionId` (if set), schedule `internal.profile.extractPositions`
   30 minutes out, and patch the conversation with the new job id and
   `lastMessageAt`. Eligibility is one indexed read (`profileSettings.by_user`)
   plus the plan lookup the mutation already does.
2. **`extractPositions` (internalAction).** Re-checks eligibility (the user may
   have paused or opted out during the idle window). Loads the thread messages
   after `lastExtractedMessageId`; if no new *user* messages, exits. Runs one
   Haiku 4.5 call with the extraction prompt. Parses/validates the JSON;
   inserts valid claims via an internal mutation that also advances
   `lastExtractedMessageId` and clears `pendingExtractionId`. Any parse or API
   failure extracts nothing (fail-closed) but still clears the pending id.
3. **Extraction prompt (`lib/extraction.ts`, pure + unit-tested).** Hard rule:
   extract only first-person user affirmations — never the assistant's claims,
   never questions, never positions voiced while steel-manning. The prompt
   receives the conversation **mode**; `devils-advocate` and `debate-prep`
   transcripts carry an explicit warning that the user may voice the opposing
   side to test it. Bias to abstain: when in doubt, return `[]`. Output is
   strict JSON (`{ claims: [...] }`) validated field-by-field against the loci
   and enums; anything malformed is dropped claim-by-claim.

## Profile page (`/profile` — "Your Theology")

New route `apps/web/src/app/profile/page.tsx`, components under
`apps/web/src/components/profile/`. Manuscript register per DESIGN.md:
Fraunces for position statements, Geist Mono for the apparatus (dates,
locus labels, framework, source links), hairline rules between loci, ink/
parchment/gold palette. It should read as the user's own confession in a
critical edition.

States:

- **Free:** locked preview — loci greyed, upgrade copy.
- **Paid, not opted in:** opt-in card with plain language on exactly what is
  stored, that it is private, exportable, and deletable, and that it is never
  used across users, in marketing, or in training.
- **Opted in, empty:** faint locus scaffolding — "this grows as you study."
- **Opted in, populated:** loci in canonical order; latest non-excluded
  position per topic, with stance/strength, date affirmed, framework at the
  time, and a link to the source conversation.

Controls (all on this page): pause/resume toggle, per-position edit
(statement text → sets `userEdited`), exclude, delete, **export** (markdown
confession, client-side download), **delete everything** (positions +
settings, with confirmation).

## Convex API surface (`packages/backend/convex/profile.ts`)

- `getProfile` (query) — settings + positions grouped by locus, latest per
  topic, excluded hidden; also returns plan gating info for the page states.
- `setOptIn`, `setPaused` (mutations)
- `editPosition`, `excludePosition`, `deletePosition` (mutations, ownership-checked)
- `deleteAllProfileData` (mutation)
- `exportProfile` (query) — markdown built by a pure `lib/profile-export.ts`
- `extractPositions` (internalAction) + internal query/mutation helpers

## Testing

TDD for the pure logic (vitest, same pattern as `prompts.test.ts` /
`usage.test.ts`):

- extraction response parsing/validation (malformed JSON, unknown locus,
  bad enums, empty)
- extraction prompt builder (mode warnings present for devils-advocate)
- markdown export builder
- grouping/latest-per-topic selection logic

Convex functions kept thin over the tested pure functions; end-to-end
verified manually against the dev deployment.

## Out of scope (Phases 2–3)

Tension detection and the `tensions` table, tensions UI, dismissal-rate
monitoring, profile summary generation and prompt injection, followup chips,
development-over-time view. The spec's manual quality review across ≥50 real
conversations gates Phase 2.
