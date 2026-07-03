# Smooth Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assistant replies stream character-by-character, and tagged blocks render their card the moment the opening tag completes, filling in as tokens arrive.

**Architecture:** A keyed smoothing hook in the web app interpolates between Convex delta batches; `parseBlocks` gains a partial-block mode that emits open-but-unclosed tags as streaming blocks instead of withholding them; the backend switches stream-delta chunking from punctuation to word granularity. Spec: `docs/superpowers/specs/2026-07-02-smooth-streaming-design.md`.

**Tech Stack:** Next.js 16 app (`apps/web`), Convex + `@convex-dev/agent` backend (`packages/backend`), vitest, bun.

## Global Constraints

- Package manager / runner: **bun** (`bun run …`, `bunx …`). Monorepo tasks via turbo from the repo root.
- Commit directly to `master` (this repo's working convention).
- Web tests: run from `apps/web` with `bun run test` (vitest; append a file path to filter).
- Final (non-partial) parse semantics must not change: every existing non-partial test passes unmodified.
- The parser must never throw on model output.
- No new dependencies.

---

### Task 1: Backend word-level delta chunking

**Files:**
- Modify: `packages/backend/convex/chat.ts:174`

**Interfaces:**
- Consumes: `StreamingOptions` from `@convex-dev/agent` (`chunking?: "word" | "line" | RegExp`, `throttleMs?` defaults to 250).
- Produces: nothing new — behavior-only change; deltas now flush every throttle window instead of waiting for punctuation.

- [ ] **Step 1: Change the saveStreamDeltas option**

In `streamReply` in `packages/backend/convex/chat.ts`, replace:

```ts
        { saveStreamDeltas: true },
```

with:

```ts
        { saveStreamDeltas: { chunking: "word" } },
```

(The default 250ms throttle stays; the client-side smoother interpolates across it.)

- [ ] **Step 2: Typecheck**

Run from repo root: `bun run check-types`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/chat.ts
git commit -m "feat(backend): word-level chunking for stream deltas"
```

---

### Task 2: `streaming` flag on the last block in partial mode

**Files:**
- Modify: `apps/web/src/components/chat/lib/chat-state.ts:22-66` (Block type)
- Modify: `apps/web/src/components/chat/lib/parse-blocks.ts` (parseBlocks tail)
- Test: `apps/web/src/components/chat/lib/parse-blocks.test.ts`

**Interfaces:**
- Consumes: existing `Block` union and `parseBlocks(text, opts)`.
- Produces: `Block` becomes `BlockVariant & { streaming?: boolean }`. In partial mode, exactly the last emitted block has `streaming: true`; in final mode the field is never set. Later tasks (partial blocks, caret UI) rely on this.

- [ ] **Step 1: Update the Block type**

In `apps/web/src/components/chat/lib/chat-state.ts`, wrap the existing union and add the flag (keep every variant exactly as-is):

```ts
export type Block = (
  | { type: "prose"; text: string }
  | { type: "scripture"; reference: string; text: string }
  | { type: "history"; heading: string; text: string }
  | {
      type: "lexicon";
      entries: { term: string; translit: string; gloss: string }[];
    }
  | {
      type: "comparison";
      columns: {
        tradition: string;
        position: string;
        texts: string;
        theologians: string;
      }[];
    }
  | {
      type: "points";
      kind: "objection" | "response";
      items: { title: string; body: string; weight?: string }[];
    }
  | {
      type: "resources";
      items: {
        title: string;
        author: string;
        tier: "introductory" | "intermediate" | "scholarly";
        note: string;
      }[];
    }
  | {
      type: "source";
      work: string;
      author: string;
      citation: string;
      excerpt: string;
    }
  | {
      type: "article";
      source: string;
      label: string;
      body: string;
      proofs?: string[];
    }
) & {
  /** Set on the last block of a partial parse: content still filling in. */
  streaming?: boolean;
};
```

Update the doc comment above it to mention the flag if you touch it; otherwise leave surrounding comments alone.

- [ ] **Step 2: Write the failing test**

Add to the `parseBlocks — streaming partials` describe block in `parse-blocks.test.ts`:

```ts
  it("marks the last block streaming in partial mode only", () => {
    const partial = parseBlocks("First done.\n\nSecond arrivi", { partial: true });
    expect(partial.blocks).toEqual([
      { type: "prose", text: "First done." },
      { type: "prose", text: "Second arrivi", streaming: true },
    ]);

    const final = parseBlocks("First done.\n\nSecond done.");
    expect(final.blocks.every((b) => b.streaming === undefined)).toBe(true);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: FAIL — the new test's first `toEqual` reports missing `streaming: true`.

- [ ] **Step 4: Implement the flag**

In `parse-blocks.ts`, immediately before `return { blocks, actions, pending };` at the end of `parseBlocks`, add:

```ts
  if (opts?.partial && blocks.length > 0) {
    blocks[blocks.length - 1]!.streaming = true;
  }
```

- [ ] **Step 5: Update the three existing partial-mode expectations**

These now see `streaming: true` on their final block. In the `streaming partials` describe block:

In "withholds a trailing unclosed tag and reports pending":

```ts
    expect(blocks).toEqual([{ type: "prose", text: "Intro prose.", streaming: true }]);
```

In "withholds a partially typed opening tag":

```ts
    expect(blocks).toEqual([{ type: "prose", text: "Prose so far", streaming: true }]);
```

In "streams trailing prose live":

```ts
    expect(blocks).toEqual([
      { type: "prose", text: "Streaming prose still arrivi", streaming: true },
    ]);
```

- [ ] **Step 6: Run the full test file**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/chat/lib/chat-state.ts apps/web/src/components/chat/lib/parse-blocks.ts apps/web/src/components/chat/lib/parse-blocks.test.ts
git commit -m "feat(web): mark the last partial-parse block as streaming"
```

---

### Task 3: Partial blocks for body tags (scripture, history, source, article)

**Files:**
- Modify: `apps/web/src/components/chat/lib/parse-blocks.ts`
- Test: `apps/web/src/components/chat/lib/parse-blocks.test.ts`

**Interfaces:**
- Consumes: `toBlock`, `parseAttrs`, `unescapeEntities`, the `streaming` flag from Task 2.
- Produces:
  - `function stripPartialTag(s: string): string` — drops a half-typed `<…` tag hanging off the end of streaming text (Task 4 reuses it).
  - `function toPartialBlock(tag: Exclude<TagName, "followups">, attrs: Record<string, string>, inner: string): Block | null` — partial block for an unclosed tag, `null` when it must stay withheld (Task 4 extends its container cases).
  - Behavior: in partial mode, an unclosed body tag with its required attribute emits a block whose text grows; missing required attribute ⇒ withheld exactly as before.

- [ ] **Step 1: Write the failing tests**

Add to the `streaming partials` describe block:

```ts
  it("emits a partial scripture block once its open tag completes", () => {
    const { blocks, pending } = parseBlocks(
      '<scripture ref="John 1:1">In the beginning was the W',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "scripture",
        reference: "John 1:1",
        text: "In the beginning was the W",
        streaming: true,
      },
    ]);
    expect(pending).toBe(true);
  });

  it("a partial body strips a half-typed closing tag", () => {
    const { blocks } = parseBlocks(
      '<source work="Confessions" author="Augustine" citation="I.1">Our heart is restless</sou',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "source",
        work: "Confessions",
        author: "Augustine",
        citation: "I.1",
        excerpt: "Our heart is restless",
        streaming: true,
      },
    ]);
  });

  it("a partial article carries its proofs from the open tag", () => {
    const { blocks } = parseBlocks(
      '<article source="Westminster Confession" label="III.1" proofs="Eph 1:11; Rom 11:33">God orda',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "article",
        source: "Westminster Confession",
        label: "III.1",
        body: "God orda",
        proofs: ["Eph 1:11", "Rom 11:33"],
        streaming: true,
      },
    ]);
  });

  it("an unclosed body tag missing its required attribute stays withheld", () => {
    const { blocks, pending } = parseBlocks("Intro.\n\n<scripture>In the begi", {
      partial: true,
    });
    expect(blocks).toEqual([{ type: "prose", text: "Intro.", streaming: true }]);
    expect(pending).toBe(true);
  });

  it("a partial body tag with an empty body still renders its shell", () => {
    const { blocks } = parseBlocks('<history heading="An old debate">', {
      partial: true,
    });
    expect(blocks).toEqual([
      { type: "history", heading: "An old debate", text: "", streaming: true },
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: FAIL — the five new tests get `[{ type: "prose", … }]`-style withholding instead of partial blocks. NOTE: the pre-existing test "withholds a trailing unclosed tag and reports pending" uses a `<points>` tag; it must still pass after this task (containers are Task 4).

- [ ] **Step 3: Implement partial body blocks**

In `parse-blocks.ts`, add below `pushProse`:

```ts
/** Drop a partially typed tag hanging off the end of streaming text. */
function stripPartialTag(s: string): string {
  return s.replace(/<[^>]*$/, "");
}

/**
 * Partial-mode counterpart of toBlock: builds a block for a tag whose closing
 * tag has not arrived yet. Attributes are complete (they live in the opening
 * tag); the body may be empty or mid-word. Returns null when the tag should
 * stay withheld (missing required attribute, or not yet supported here).
 */
function toPartialBlock(
  tag: Exclude<TagName, "followups">,
  attrs: Record<string, string>,
  inner: string,
): Block | null {
  const body = unescapeEntities(stripPartialTag(inner).trim());
  switch (tag) {
    case "scripture":
      return attrs.ref
        ? { type: "scripture", reference: attrs.ref, text: body }
        : null;
    case "history":
      return attrs.heading
        ? { type: "history", heading: attrs.heading, text: body }
        : null;
    case "source":
      return attrs.work
        ? {
            type: "source",
            work: attrs.work,
            author: attrs.author ?? "",
            citation: attrs.citation ?? "",
            excerpt: body,
          }
        : null;
    case "article": {
      if (!attrs.label) return null;
      const proofs = attrs.proofs
        ? attrs.proofs.split(";").map((p) => p.trim()).filter(Boolean)
        : undefined;
      return {
        type: "article",
        source: attrs.source ?? "",
        label: attrs.label,
        body,
        ...(proofs && proofs.length > 0 ? { proofs } : {}),
      };
    }
    case "lexicon":
    case "comparison":
    case "points":
    case "resources":
      return null; // containers: Task 4
  }
}
```

Then replace the unclosed-tag partial branch inside the `while` loop (currently the `if (closeIndex === -1)` block) with:

```ts
    if (closeIndex === -1) {
      if (opts?.partial) {
        // Unclosed tag while streaming: emit the prose before it, then a
        // partial block that fills in as its content arrives. followups and
        // unsupported partials stay withheld.
        pushProse(blocks, text.slice(cursor, match.index));
        if (tag !== "followups") {
          const block = toPartialBlock(tag, parseAttrs(match[2]), text.slice(openEnd));
          if (block) blocks.push(block);
        }
        cursor = text.length;
        pending = true;
        break;
      }
      // Final text with an unclosed tag: leave it for the prose tail (degrade).
      continue;
    }
```

Import nothing new — `Block` is already imported from `./chat-state`.

- [ ] **Step 4: Run tests to verify they pass**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: PASS — all tests, including every pre-existing final-parse test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/lib/parse-blocks.ts apps/web/src/components/chat/lib/parse-blocks.test.ts
git commit -m "feat(web): stream body-tag blocks as they arrive"
```

---

### Task 4: Partial blocks for container tags (lexicon, comparison, points, resources)

**Files:**
- Modify: `apps/web/src/components/chat/lib/parse-blocks.ts`
- Test: `apps/web/src/components/chat/lib/parse-blocks.test.ts`

**Interfaces:**
- Consumes: `toPartialBlock`, `stripPartialTag`, `children`, `toBlock` from Task 3 / existing code.
- Produces:
  - `function trailingChild(inner: string, tag: string): { attrs: Record<string, string>; body: string } | null` — the in-progress last child whose open tag is complete.
  - Shared extractors `pointItems(inner)` / `resourceItems(inner)` used by both `toBlock` and `toPartialBlock` (DRY).
  - Behavior: unclosed containers render with completed children; `points`/`resources` also include the in-progress child with its streaming body; a container with nothing to show stays withheld; `followups` remains withheld (already handled in Task 3's branch).

- [ ] **Step 1: Replace the superseded withholding test and add container tests**

Delete the test "withholds a trailing unclosed tag and reports pending" (its `<points>` input now emits a block). In its place, and alongside, add to the `streaming partials` describe block:

```ts
  it("streams points: completed items plus the in-progress one", () => {
    const { blocks, pending } = parseBlocks(
      '<points kind="objection"><point title="First" weight="Strong">Done body.</point><point title="Second">Half of the bo',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "points",
        kind: "objection",
        items: [
          { title: "First", body: "Done body.", weight: "Strong" },
          { title: "Second", body: "Half of the bo" },
        ],
        streaming: true,
      },
    ]);
    expect(pending).toBe(true);
  });

  it("streams resources: completed items plus the in-progress one", () => {
    const { blocks } = parseBlocks(
      '<resources><item title="Institutes" author="John Calvin" tier="scholarly">The fountainhead.</item><item title="Bondage" author="Luther" tier="intermediate">Why it ma',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "resources",
        items: [
          { title: "Institutes", author: "John Calvin", tier: "scholarly", note: "The fountainhead." },
          { title: "Bondage", author: "Luther", tier: "intermediate", note: "Why it ma" },
        ],
        streaming: true,
      },
    ]);
  });

  it("streams lexicon entries as each completes", () => {
    const { blocks } = parseBlocks(
      '<lexicon><entry term="λόγος" translit="logos" gloss="word" /><entry term="ἀρχή" translit="arch',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "lexicon",
        entries: [{ term: "λόγος", translit: "logos", gloss: "word" }],
        streaming: true,
      },
    ]);
  });

  it("streams comparison columns as each completes", () => {
    const { blocks } = parseBlocks(
      '<comparison><column tradition="Reformed"><position>Monergism.</position><texts>Rom 9:16</texts><theologians>Calvin</theologians></column><column tradition="Lutheran"><position>Means of gra',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "comparison",
        columns: [
          { tradition: "Reformed", position: "Monergism.", texts: "Rom 9:16", theologians: "Calvin" },
        ],
        streaming: true,
      },
    ]);
  });

  it("an unclosed container with no complete children stays withheld", () => {
    const { blocks, pending } = parseBlocks('Intro.\n\n<lexicon><entry term="λό', {
      partial: true,
    });
    expect(blocks).toEqual([{ type: "prose", text: "Intro.", streaming: true }]);
    expect(pending).toBe(true);
  });

  it("a streaming followups tag stays withheld until closed", () => {
    const { blocks, actions, pending } = parseBlocks(
      'Answer.\n\n<followups><q label="Next">Wha',
      { partial: true },
    );
    expect(blocks).toEqual([{ type: "prose", text: "Answer.", streaming: true }]);
    expect(actions).toEqual([]);
    expect(pending).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: FAIL — the four container-streaming tests get withheld output; the withheld/followups tests already pass (guard against regression).

- [ ] **Step 3: Extract shared item builders**

In `parse-blocks.ts`, add above `toBlock` (and delete the corresponding inline logic from `toBlock`'s `points` and `resources` cases, replacing it with calls):

```ts
function pointItems(
  inner: string,
): { title: string; body: string; weight?: string }[] {
  return children(inner, "point")
    .map((p) => ({
      title: p.attrs.title ?? "",
      body: unescapeEntities(p.body),
      ...(p.attrs.weight ? { weight: p.attrs.weight } : {}),
    }))
    .filter((i) => i.title && i.body);
}

function resourceTier(raw: string | undefined): Tier {
  return (TIERS as readonly string[]).includes(raw ?? "")
    ? (raw as Tier)
    : "introductory";
}

function resourceItems(
  inner: string,
): { title: string; author: string; tier: Tier; note: string }[] {
  return children(inner, "item")
    .map((it) => ({
      title: it.attrs.title ?? "",
      author: it.attrs.author ?? "",
      tier: resourceTier(it.attrs.tier),
      note: unescapeEntities(it.body),
    }))
    .filter((i) => i.title);
}
```

(`TIERS`/`Tier` are declared above `toBlock` today — move them above these helpers if needed.) `toBlock`'s cases become:

```ts
    case "points": {
      const kind = attrs.kind === "response" ? "response" : "objection";
      const items = pointItems(inner);
      return items.length > 0 ? { type: "points", kind, items } : null;
    }
    case "resources": {
      const items = resourceItems(inner);
      return items.length > 0 ? { type: "resources", items } : null;
    }
```

- [ ] **Step 4: Implement trailingChild and the container cases**

Add below `stripPartialTag`:

```ts
/** The in-progress last <tag …>body child of `inner`, if its open tag is complete. */
function trailingChild(
  inner: string,
  tag: string,
): { attrs: Record<string, string>; body: string } | null {
  const close = `</${tag}>`;
  const last = inner.lastIndexOf(close);
  const rest = inner.slice(last === -1 ? 0 : last + close.length);
  const m = rest.match(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*)$`));
  return m ? { attrs: parseAttrs(m[1]), body: m[2] ?? "" } : null;
}
```

Replace the four container cases at the end of `toPartialBlock`:

```ts
    case "lexicon":
    case "comparison":
      // Attribute/field-based children render only once complete.
      return toBlock(tag, attrs, inner);
    case "points": {
      const kind = attrs.kind === "response" ? "response" : "objection";
      const items = pointItems(inner);
      const tail = trailingChild(inner, "point");
      if (tail?.attrs.title) {
        items.push({
          title: tail.attrs.title,
          body: unescapeEntities(stripPartialTag(tail.body).trim()),
          ...(tail.attrs.weight ? { weight: tail.attrs.weight } : {}),
        });
      }
      return items.length > 0 ? { type: "points", kind, items } : null;
    }
    case "resources": {
      const items = resourceItems(inner);
      const tail = trailingChild(inner, "item");
      if (tail?.attrs.title) {
        items.push({
          title: tail.attrs.title,
          author: tail.attrs.author ?? "",
          tier: resourceTier(tail.attrs.tier),
          note: unescapeEntities(stripPartialTag(tail.body).trim()),
        });
      }
      return items.length > 0 ? { type: "resources", items } : null;
    }
```

- [ ] **Step 5: Run the full test file**

Run from `apps/web`: `bun run test src/components/chat/lib/parse-blocks.test.ts`
Expected: PASS — every test, including all pre-existing final-parse tests.

- [ ] **Step 6: Run the whole web test suite**

Run from `apps/web`: `bun run test`
Expected: PASS (chat-state, exchanges, frameworks, inline, modes tests untouched and green).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/chat/lib/parse-blocks.ts apps/web/src/components/chat/lib/parse-blocks.test.ts
git commit -m "feat(web): stream container blocks child by child"
```

---

### Task 5: Keyed smooth-text hook

**Files:**
- Create: `apps/web/src/components/chat/lib/use-smooth-stream-text.ts`

**Interfaces:**
- Consumes: React only.
- Produces: `function useSmoothStreamText(key: string, text: string, streaming: boolean): string` — Task 6 calls it with the streaming message's key/text/status.

Why not `useSmoothText` from `@convex-dev/agent/react`: its cursor state is a single unkeyed ref, so after one message finishes, the stale cursor (at the old text length) breaks the reveal for the next message streaming through the same hook instance. This keyed variant resets per message; the rate-adaptation approach mirrors the library's.

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useRef, useState } from "react";

const FPS = 30;
const INITIAL_CHARS_PER_SEC = 120;

interface SmoothState {
  key: string;
  cursor: number;
  charsPerMs: number;
  lastLen: number;
  lastTime: number;
}

/**
 * Reveals `text` character by character at a rate that tracks how fast new
 * characters actually arrive, so throttled stream-delta batches read as a
 * steady flow. State resets when `key` changes (a new message); a message
 * first seen with `streaming` false renders in full immediately. After the
 * source stops streaming, the reveal keeps going until it catches up.
 */
export function useSmoothStreamText(
  key: string,
  text: string,
  streaming: boolean,
): string {
  const ref = useRef<SmoothState | null>(null);
  if (ref.current === null || ref.current.key !== key) {
    ref.current = {
      key,
      cursor: streaming ? 0 : text.length,
      charsPerMs: INITIAL_CHARS_PER_SEC / 1000,
      lastLen: text.length,
      lastTime: Date.now(),
    };
  }
  const state = ref.current;

  if (text.length > state.lastLen) {
    // New characters arrived: blend the observed arrival rate (plus a
    // catch-up term for accumulated lag) into the reveal rate, capped at
    // doubling per batch so a large paste-like delta doesn't teleport.
    const now = Date.now();
    const elapsed = Math.max(1, now - state.lastTime);
    const arrivalRate = (text.length - state.lastLen) / elapsed;
    const lagRate = Math.max(0, state.lastLen - state.cursor) / elapsed;
    state.charsPerMs = Math.min(
      (2 * (arrivalRate + lagRate) + state.charsPerMs) / 3,
      state.charsPerMs * 2,
    );
    state.lastLen = text.length;
    state.lastTime = now;
  }

  const animating = state.cursor < text.length;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!animating) return;
    let tick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const chars = Math.floor((now - tick) * state.charsPerMs);
      if (chars <= 0) return;
      state.cursor = Math.min(state.cursor + chars, text.length);
      tick = now;
      rerender((n) => n + 1);
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [animating, text, state]);

  return animating ? text.slice(0, state.cursor) : text;
}
```

(No unit test: the web workspace has no DOM/hook test harness — vitest only, no testing-library. The hook is exercised end-to-end in Task 8's manual verification.)

- [ ] **Step 2: Typecheck**

Run from repo root: `bun run check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/lib/use-smooth-stream-text.ts
git commit -m "feat(web): keyed smooth-text hook for streamed messages"
```

---

### Task 6: Wire smoothing + partial parsing into LiveThread

**Files:**
- Modify: `apps/web/src/components/chat/live-thread.tsx`

**Interfaces:**
- Consumes: `useSmoothStreamText(key, text, streaming)` from Task 5; `parseBlocks(text, { partial })`; `UIMessage` (`key`, `text`, `role`, `status`).
- Produces: `LiveThread` renders the streaming message from the smoothed prefix with partial parsing; `isStreaming` now also covers the catch-up tail (deltas done, reveal still running) so the composer stays locked and followup chips stay hidden until the animation lands.

- [ ] **Step 1: Rewrite live-thread.tsx**

Replace the body of `apps/web/src/components/chat/live-thread.tsx` between the imports and `export default` as follows — full file for clarity:

```tsx
"use client";

import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import ChatThread from "./chat-thread";
import {
  blocksToText,
  type Action,
  type Conversation,
  type Message,
} from "./lib/chat-state";
import { parseBlocks } from "./lib/parse-blocks";
import { useSmoothStreamText } from "./lib/use-smooth-stream-text";

/** A Convex-backed conversation: the mock Conversation shape plus its ids. */
export interface LiveConversation extends Conversation {
  threadId: string;
  convexId: Id<"conversations">;
}

function toMessage(m: UIMessage, text: string, partial: boolean): Message | null {
  if (m.role === "user") {
    return { id: m.key, role: "user", content: m.text };
  }
  if (m.role !== "assistant") return null;
  const parsed = parseBlocks(text, { partial });
  if (parsed.blocks.length === 0) return null; // nothing renderable yet
  return {
    id: m.key,
    role: "assistant",
    content: blocksToText(parsed.blocks),
    blocks: parsed.blocks,
    actions: parsed.actions.length > 0 ? parsed.actions : undefined,
  };
}

export default function LiveThread({
  conversation,
}: {
  conversation: LiveConversation;
}) {
  const { results } = useUIMessages(
    api.chat.listThreadMessages,
    { threadId: conversation.threadId },
    { initialNumItems: 50, stream: true },
  );
  const sendMessage = useMutation(api.chat.sendMessage);

  const uiMessages = results ?? [];
  const last = uiMessages.at(-1);
  const lastAssistant = last && last.role === "assistant" ? last : undefined;

  // Only the newest assistant message can stream; smooth its text so delta
  // batches read as a steady character flow. Streaming lasts until the
  // deltas stop AND the reveal catches up.
  const smoothText = useSmoothStreamText(
    lastAssistant?.key ?? "",
    lastAssistant?.text ?? "",
    lastAssistant?.status === "streaming",
  );
  const isStreaming =
    lastAssistant !== undefined &&
    (lastAssistant.status === "streaming" ||
      smoothText.length < lastAssistant.text.length);

  const messages = uiMessages
    .map((m) =>
      m === lastAssistant
        ? toMessage(m, smoothText, isStreaming)
        : toMessage(m, m.text, false),
    )
    .filter((m): m is Message => m !== null);

  const isReplying = messages.at(-1)?.role === "user";

  function send(text: string) {
    if (isReplying || isStreaming) return;
    sendMessage({ conversationId: conversation.convexId, text }).catch(() => {
      toast.error("Could not send the message. Please try again.");
    });
  }

  return (
    <ChatThread
      conversation={{ ...conversation, messages }}
      isReplying={isReplying}
      isStreaming={isStreaming}
      onSend={send}
      onAction={(action: Action) => send(action.prefill)}
    />
  );
}
```

- [ ] **Step 2: Typecheck and run web tests**

Run from repo root: `bun run check-types` — Expected: PASS.
Run from `apps/web`: `bun run test` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/live-thread.tsx
git commit -m "feat(web): smooth character streaming in live threads"
```

---

### Task 7: Streaming caret in MessageBlocks

**Files:**
- Modify: `apps/web/src/components/chat/message-blocks.tsx`
- Modify: `apps/web/src/components/chat/message-blocks.module.css`

**Interfaces:**
- Consumes: `Block.streaming` from Task 2.
- Produces: a blinking caret at the end of the actively filling text. Prose, scripture, history, source, and article get it on their body text; points/resources on the last item's body/note; lexicon/comparison none (their children pop in complete).

- [ ] **Step 1: Add the caret styles**

Append to `apps/web/src/components/chat/message-blocks.module.css` (match the file's existing class-naming style):

```css
.caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  margin-left: 3px;
  vertical-align: -0.12em;
  background: currentColor;
  opacity: 0.7;
  animation: caretBlink 1s steps(2, jump-none) infinite;
}

@keyframes caretBlink {
  50% {
    opacity: 0;
  }
}
```

- [ ] **Step 2: Render the caret**

In `message-blocks.tsx`, add a tiny component above `BlockView`:

```tsx
function Caret({ show }: { show?: boolean }) {
  return show ? <span className={styles.caret} aria-hidden /> : null;
}
```

Then append it to the filling text of each case in `BlockView`:

- `prose`: `<p className={styles.prose}>{renderInline(block.text)}<Caret show={block.streaming} /></p>`
- `scripture`: `<p className={styles.scriptureText}>{block.text}<Caret show={block.streaming} /></p>`
- `history`: `<p className={styles.historyText}>{renderInline(block.text)}<Caret show={block.streaming} /></p>`
- `source`: `<blockquote className={styles.sourceExcerpt}>{renderInline(block.excerpt)}<Caret show={block.streaming} /></blockquote>`
- `article`: `<p className={styles.articleBody}>{renderInline(block.body)}<Caret show={block.streaming} /></p>`
- `points` (the map already has `index`): `<p className={styles.pointText}>{renderInline(item.body)}<Caret show={block.streaming && index === block.items.length - 1} /></p>`
- `resources` — add the index parameter to the map (`block.items.map((item, index) => …)`) and: `<p className={styles.resourceNote}>{item.note}<Caret show={block.streaming && index === block.items.length - 1} /></p>`
- `lexicon`, `comparison`: unchanged.

- [ ] **Step 3: Typecheck and test**

Run from repo root: `bun run check-types` — Expected: PASS.
Run from `apps/web`: `bun run test` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/message-blocks.tsx apps/web/src/components/chat/message-blocks.module.css
git commit -m "feat(web): blinking caret on the streaming block"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suites**

Run from `apps/web`: `bun run test` — Expected: PASS.
Run from `packages/backend`: `bun run test` — Expected: PASS.
Run from repo root: `bun run check-types` — Expected: PASS.
Run from repo root: `bun run build` — Expected: succeeds.

- [ ] **Step 2: Manual verification in the running app**

Start dev (`bun run dev` from repo root; web is on port 3001, Convex dev must be running). In a chat:

1. Send a question in Q&A mode → prose appears character by character, no sentence-sized jumps.
2. Trigger a Scripture Study reply → the scripture card appears as soon as `<scripture …>` completes, with its text filling in and a caret blinking at the end.
3. Trigger a Comparison-mode reply → the comparison card grows column by column.
4. Confirm followup chips appear only after the reveal fully lands, the composer unlocks at the same moment, and a finished reply re-renders identically after a page reload (final parse path).

Report any deviation instead of claiming success.

- [ ] **Step 3: Done**

No final commit needed unless verification forced fixes; if it did, commit them with a `fix(web): …` message describing the actual defect.

---

## Self-Review Notes

- Spec coverage: backend chunking (Task 1), smoothing (Tasks 5-6), partial body tags (Task 3), partial containers + followups withheld (Task 4), `streaming` flag (Task 2), caret (Task 7), tests throughout, manual verify (Task 8). Error-handling requirement (never throw, final parse authoritative) is preserved by keeping `toPartialBlock` null-returning and final-mode code untouched.
- Type consistency: `toPartialBlock` and `trailingChild` signatures match between Tasks 3 and 4; `useSmoothStreamText(key, text, streaming)` matches between Tasks 5 and 6; `Block.streaming` matches between Tasks 2, 4, and 7.
