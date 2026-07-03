# Smooth Streaming Design

**Date:** 2026-07-02
**Status:** Approved

## Problem

Assistant replies render in visible chunks rather than a smooth token flow, and
tagged blocks (scripture, comparison, points, …) pop in fully formed only after
their closing tag arrives — a long block means seconds of nothing, then a card.

Two causes:

1. **Backend delta granularity.** `streamReply` (packages/backend/convex/chat.ts)
   passes `saveStreamDeltas: true`, which uses the agent defaults: deltas chunked
   by a punctuation regex and throttled to 250ms. Text reaches the client in
   sentence-sized bursts.
2. **Client rendering.** The client applies each delta batch as a jump (no
   interpolation), and `parseBlocks` (apps/web/src/components/chat/lib/parse-blocks.ts)
   withholds the entirety of an unclosed tag while streaming.

## Goals

- Text appears character by character, at a rate matched to actual arrival speed.
- The moment a known tag's opening tag is complete, its card renders and fills
  in as content streams.
- No change to the final (non-streaming) parse semantics: completed messages
  render exactly as they do today.

## Approach

Client-side smoothing plus a streaming-aware parser, with a one-line backend
chunking tweak. Alternatives rejected: backend-only finer throttling (still
steppy, doesn't address tag withholding, more DB writes) and direct HTTP
streaming (forfeits the agent component's reactive persistence/resume for
marginal gain).

### Backend

In `streamReply`, replace `{ saveStreamDeltas: true }` with
`{ saveStreamDeltas: { chunking: "word" } }`. The 250ms default throttle stays;
word chunking means a delta batch never waits for punctuation, so the client
smoother has fresh text every throttle window.

### Client smoothing (LiveThread)

Only the last message can be streaming. `LiveThread` calls `useSmoothText`
(from `@convex-dev/agent/react` — adaptive chars/sec, 20fps interval) once,
unconditionally, on the streaming message's text (empty string when nothing is
streaming, satisfying hook rules). The smoothed prefix — not the raw text — is
what gets parsed for the streaming message. The parser's existing trailing
partial-open-tag guard (`/<[a-z][^>]*$/i`) already handles the smoother
revealing `<scriptu` mid-tag: nothing renders until `>` completes the open tag.

### Streaming-aware parser (parse-blocks.ts)

In partial mode, an open-but-unclosed known tag no longer sets `pending` and
withholds; it emits a **partial block** built from the open tag's attributes and
the inner text so far:

- **Body tags** (`scripture`, `history`, `source`, `article`): emit the block
  with its growing body text. Attributes are always complete by then (they live
  in the opening tag); validation relaxes only in that an empty body still
  renders the card shell. The final (non-partial) parse keeps today's
  strictness.
- **Container tags** (`lexicon`, `comparison`, `points`, `resources`): emit the
  block immediately; include each child as it completes. For children with text
  bodies (`point`, resource `item`), also include the trailing in-progress
  child with its streaming body. Attribute-only children (`entry`, and
  `column`'s inner fields) appear only once complete.
- **`followups`**: unchanged — withheld until closed. Action chips only display
  after streaming ends.
- A trailing half-typed opening tag is still held back as today.

The parsed result marks the in-progress block via an optional `streaming: true`
field on the Block union member (only ever the last block, only in partial
mode). Unknown/malformed tag degradation is unchanged.

### UI (MessageBlocks)

Blocks render with their existing card styles from the first character. The
block carrying `streaming: true` shows a subtle caret at the end of its filling
text (CSS, in message-blocks.module.css). No skeletons or shimmer.

## Error handling

- The parser continues to never throw on model output; partial blocks that turn
  out malformed at close time degrade to prose exactly as today's final parse
  does (the final parse is authoritative).
- If `useSmoothText` falls behind (large paste-like delta), its adaptive rate
  catches up on its own; no manual cursor management.

## Testing

- Extend `parse-blocks.test.ts`: partial-mode cases asserting partial-block
  emission for each tag category (body tag mid-stream, container with N
  complete children + 1 in-progress, followups still withheld, half-typed open
  tag still held, final-parse strictness unchanged).
- Existing tests for final parses must pass unmodified.
- Manual verification in the running app: watch a comparison-mode reply stream.

## Files touched

- `packages/backend/convex/chat.ts` — chunking option.
- `apps/web/src/components/chat/lib/parse-blocks.ts` — partial blocks.
- `apps/web/src/components/chat/lib/chat-state.ts` — optional `streaming` flag.
- `apps/web/src/components/chat/live-thread.tsx` — useSmoothText integration.
- `apps/web/src/components/chat/message-blocks.tsx` (+ module.css) — caret.
- `apps/web/src/components/chat/lib/parse-blocks.test.ts` — new cases.
