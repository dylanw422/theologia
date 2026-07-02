# Convex + Anthropic Chat Integration — Design

**Date:** 2026-07-02
**Status:** Approved
**Scope:** Wire the `/chat` surface to real AI via the Convex AI Agent component and the Anthropic API (Claude Sonnet 4.6), with per-mode structured output matching the existing mock-thread block formats. Mock threads remain until live output is verified.

## Goals

- Real streaming AI replies in all eight study modes, formatted with the same
  typed blocks the mock threads use (scripture quotes, church-history asides,
  objection/response boxes, comparison columns, lexicon entries, resources,
  sources, articles).
- Structured sections appear **only when they genuinely serve the answer** —
  most replies are mostly prose.
- Replies sometimes end with 1–2 follow-up chips (e.g. "How has my tradition
  read this?") that send a full question as the next user message.
- Mock seed conversations remain untouched and functional until live output is
  verified across modes.

## Decisions (settled with Dylan)

| Decision | Choice |
|---|---|
| Delivery | Streaming text with lightweight XML tags, parsed client-side into the existing `Block[]` union |
| Model | `claude-sonnet-4-6` via `@ai-sdk/anthropic` |

## Architecture

### Backend (`packages/backend`)

**Dependencies:** `@convex-dev/agent`, `@ai-sdk/anthropic`, `ai`. Register the
agent component in `convex.config.ts` alongside better-auth and Polar.

**Schema:** new `conversations` table:

- `userId` (better-auth user), `mode` (one of the eight `ModeId`s)
- setup fields: `framework`, `subTradition`, `opposing`, `traditions`,
  `document`, `purpose`, `collection` (all optional; mirrors
  `ConversationSetup`)
- `title` (derived from first message, same rule as the mock), `threadId`
  (Agent component thread id)
- Index on `userId`.

Messages live exclusively in the Agent component's storage — never duplicated
in our tables.

**`convex/chat.ts`:**

- `createConversation` (mutation): require auth → create agent thread → insert
  `conversations` row → schedule streaming reply for the first message.
- `sendMessage` (mutation): require auth + ownership → save user message →
  schedule streaming reply.
- `listConversations` (query): current user's conversations, newest first.
- `getConversation` (query): one conversation with setup.
- Message/stream queries built on the component's `listMessages` +
  `syncStreams` so clients receive live deltas through normal Convex
  reactivity.
- Streaming happens in an internal action calling the agent's `streamText`
  with delta persistence enabled.

**`convex/prompts.ts`:** pure system-prompt builders, unit-testable.

- Shared base: Theologia persona + the tag vocabulary spec (one worked example
  per tag) + rules: structured sections only when warranted; sometimes end
  with 1–2 `<followups>` chips; write from within the user's locked tradition
  where the mode calls for it.
- Per-mode section: injects the conversation's locked setup with human labels
  resolved server-side. To keep one source of truth, the static
  framework/document/collection/purpose data (currently in
  `apps/web/src/components/chat/lib/frameworks.ts` and `modes.ts`) moves to a
  plain TS module in `packages/backend`, and the web app imports it from
  there.
- The mode behavioral contracts:
  - **Q&A** — answer from within the tradition; scripture/history when apt.
  - **Devil's Advocate** — argue the rival tradition's strongest case;
    `points kind="objection"` and `kind="response"` boxes; never strawman.
  - **Comparison** — must produce a `comparison` block with exactly the
    selected traditions; none privileged.
  - **Debate Prep** — rank objections to the user's thesis; drill responses.
  - **Catechism** — tutor through the chosen document; `article` blocks with
    proofs; quiz back.
  - **Resources** — tiered `resources` blocks matched to tradition + purpose.
  - **Library** — `source` excerpts from the chosen collection, explained.
  - **Scripture Study** — `scripture`, `lexicon`, `history` blocks; the
    tradition's reading; the Fathers on the text.

**Env:** `ANTHROPIC_API_KEY` on the Convex deployment.

### Tagged output format

The model streams markdown prose interleaved with tags mapping 1:1 onto the
existing `Block` union. Untagged text becomes `prose` blocks.

```
<scripture ref="Romans 9:19">You will say to me then…</scripture>
<history heading="This debate has a history">Augustine against Pelagius…</history>
<lexicon><entry term="ἐξουσία" translit="exousia" gloss="right, authority" /></lexicon>
<comparison><column tradition="Reformed"><position>…</position><texts>…</texts><theologians>…</theologians></column></comparison>
<points kind="objection"><point title="…" weight="…">body</point></points>
<resources><item title="…" author="…" tier="introductory">note</item></resources>
<source work="…" author="…" citation="…">excerpt</source>
<article source="…" label="…" proofs="Rom 3:28; Gal 2:16">body</article>
<followups><q label="How has my tradition read this?">How has my tradition historically read this passage?</q></followups>
```

### Frontend (`apps/web`)

**`components/chat/lib/parse-blocks.ts`** (+ tests): incremental parser,
tagged stream text → `{ blocks: Block[], actions: Action[] }`.

- Prose renders live as it streams.
- A structured block appears only when its closing tag arrives; a trailing
  unclosed tag is held back (no half-rendered tables).
- Malformed or unknown tags degrade to prose — never throw.
- `<followups>` maps to `Action[]`; on live threads an action click sends the
  chip's full question as a normal user message (no scripted `next`).

**`chat-app.tsx`:** two conversation sources merged in the sidebar:

- Mock seed conversations stay in local React state, answered by scripts,
  visually unchanged.
- Live conversations come from Convex (`listConversations` + the Agent
  component's React hooks with streaming). New conversations always take the
  live path.

`message-blocks.tsx` renders live blocks unchanged — the parser emits the
same `Block` union.

### Error handling

- Stream/API failures surface as a visible assistant-side error state with a
  retry affordance; `isReplying` always clears.
- Backend mutations validate auth and conversation ownership.

## Testing

- Unit: parser (happy path, streaming partials, unclosed tags, malformed
  tags, followups extraction); prompt builders (each mode includes its setup
  labels and the tag spec).
- Manual: each mode exercised against its mock exemplar's subject matter;
  output format compared to the mock threads before any mock removal.

## Out of scope

- Usage metering / Polar integration, rate limiting
- AI-generated conversation titles (title stays derived from first message)
- Removing mock threads (separate slice, after verification)
