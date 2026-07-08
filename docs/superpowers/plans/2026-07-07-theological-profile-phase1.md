# Theological Profile — Phase 1 (the ledger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 Theological Profile: opt-in belief extraction from idle conversations into a `positions` store, plus a read-only `/profile` page ("Your Theology") with edit/delete/export controls.

**Architecture:** A debounced Convex scheduled action runs a single Haiku 4.5 (`claude-haiku-4-5`) extraction pass over the *new* portion of a conversation transcript (delta keyed on the agent component's message `order`), validates the strict-JSON output with pure, unit-tested helpers, and appends claims to a `positions` table. Public Convex functions are thin auth wrappers over plain helpers so the helpers are testable with `convex-test`'s `t.run`. The Next.js `/profile` page renders the manuscript-register profile with all user controls.

**Tech Stack:** Convex (`packages/backend/convex/`), `@convex-dev/agent` 0.6.x, `@ai-sdk/anthropic` + `ai` (`generateText`), vitest + `convex-test` (edge-runtime), Next.js 16 / React 19 with CSS modules, bun workspaces.

Spec: `docs/superpowers/specs/2026-07-07-theological-profile-phase1-design.md` (companion: `docs/THEOLOGICAL_PROFILE.md`).

## Global Constraints

- **Model:** extraction uses exactly `anthropic("claude-haiku-4-5")` via `@ai-sdk/anthropic` — same provider pattern as `chat.ts` (`anthropic("claude-sonnet-5")`). Do not append a date suffix.
- **Extraction hard rule (from the spec, verbatim):** "extract only what the user affirmed in their own voice." When in doubt, extract nothing. A sparse accurate profile beats a full noisy one.
- **Copy rules:** never the word "contradiction"; never scoring/grading language; the profile is "your own confession, written by your own study." Opt-in copy must state: never used across users, never in marketing, never in training.
- **Tier gate:** extraction and profile content are Scholar+ (`getPlanIdForUser(ctx, userId) !== "free"`) AND `profileSettings.optedIn === true` AND `paused === false`. Free users see a locked preview.
- **Design register (DESIGN.md):** Fraunces for position statements, Geist Mono for apparatus (dates, locus labels, citations), Inter for body, `--ink/--parchment/--gold/--hairline` palette, hairline rules between loci. Declare CSS custom properties on the surface root.
- **Convex rules (`convex/_generated/ai/guidelines.md`):** every function has arg validators; internal functions use `internalQuery/internalMutation/internalAction`; minimize `ctx.runQuery/runMutation` calls from actions.
- **Testing:** backend tests run with `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test` (vitest). Convex-function tests follow `usage.test.ts`: `// @vitest-environment edge-runtime` header, `convexTest(schema, import.meta.glob("./**/*.ts"))`, plain helpers tested via `t.run(ctx => helper(ctx as never, ...))`, internal functions via `t.mutation(internal.…)`. Auth-gated public functions are NOT tested directly (the auth component is heavy) — keep them thin over tested helpers.
- **Git:** the working tree contains unrelated in-flight changes. Commit with **explicit file paths only** (`git add <paths>`), never `git add -A`. Commit to `master` directly (project convention). End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Monorepo commands:** package manager is bun. Full type check: `cd /Users/dylanwest/Coding/theologia && bun run check-types`.

---

### Task 1: Loci shape — `lib/profile.ts`

The shared vocabulary: the eight loci, stance/strength enums, Convex validators, and the latest-per-topic selection helper. Everything downstream (schema, extraction, export, UI) imports from here.

**Files:**
- Create: `packages/backend/convex/lib/profile.ts`
- Test: `packages/backend/convex/lib/profile.test.ts`

**Interfaces:**
- Consumes: nothing (only `convex/values`)
- Produces:
  - `LOCI: readonly {id, label}[]` (8 entries, canonical order), `LocusId`, `LOCUS_IDS`
  - `getLocusLabel(id: string): string | undefined`
  - `STANCES`/`STRENGTHS` const tuples, `Stance`, `Strength` types
  - `vLocus`, `vStance`, `vStrength` Convex validators
  - `latestPerTopic<T extends {topic: string; createdAt: number; excluded: boolean}>(positions: T[]): T[]`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/lib/profile.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { getLocusLabel, latestPerTopic, LOCI, LOCUS_IDS } from "./profile";

describe("LOCI", () => {
  it("lists the eight classical loci in canonical order", () => {
    expect(LOCUS_IDS).toEqual([
      "scripture-revelation",
      "theology-proper",
      "christology",
      "pneumatology",
      "anthropology-sin",
      "soteriology",
      "ecclesiology-sacraments",
      "eschatology",
    ]);
    expect(LOCI).toHaveLength(8);
  });

  it("resolves labels and returns undefined for unknown ids", () => {
    expect(getLocusLabel("soteriology")).toBe("Soteriology");
    expect(getLocusLabel("nope")).toBeUndefined();
  });
});

describe("latestPerTopic", () => {
  const p = (topic: string, createdAt: number, excluded = false) => ({
    topic,
    createdAt,
    excluded,
  });

  it("keeps only the newest position per topic, newest-first overall", () => {
    const result = latestPerTopic([
      p("election", 100),
      p("election", 300),
      p("baptism", 200),
    ]);
    expect(result).toEqual([p("election", 300), p("baptism", 200)]);
  });

  it("drops excluded positions entirely, even the newest", () => {
    const result = latestPerTopic([p("election", 100), p("election", 300, true)]);
    expect(result).toEqual([p("election", 100)]);
  });

  it("returns [] for empty input", () => {
    expect(latestPerTopic([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profile.test.ts`
Expected: FAIL — `Cannot find module './profile'` (or similar resolution error).

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/lib/profile.ts`:

```typescript
import { v } from "convex/values";

/**
 * The eight classical theological loci — the fixed skeleton of the profile.
 * The order here is canonical: the profile page and the markdown export
 * both render loci in this order.
 */
export const LOCI = [
  { id: "scripture-revelation", label: "Scripture & Revelation" },
  { id: "theology-proper", label: "Theology Proper" },
  { id: "christology", label: "Christology" },
  { id: "pneumatology", label: "Pneumatology" },
  { id: "anthropology-sin", label: "Anthropology & Sin" },
  { id: "soteriology", label: "Soteriology" },
  { id: "ecclesiology-sacraments", label: "Ecclesiology & Sacraments" },
  { id: "eschatology", label: "Eschatology" },
] as const;

export type LocusId = (typeof LOCI)[number]["id"];

export const LOCUS_IDS: readonly LocusId[] = LOCI.map((l) => l.id);

export function getLocusLabel(id: string): string | undefined {
  return LOCI.find((l) => l.id === id)?.label;
}

export const STANCES = ["affirmed", "denied", "uncertain"] as const;
export const STRENGTHS = ["settled", "leaning", "exploring"] as const;
export type Stance = (typeof STANCES)[number];
export type Strength = (typeof STRENGTHS)[number];

export const vLocus = v.union(
  v.literal("scripture-revelation"),
  v.literal("theology-proper"),
  v.literal("christology"),
  v.literal("pneumatology"),
  v.literal("anthropology-sin"),
  v.literal("soteriology"),
  v.literal("ecclesiology-sacraments"),
  v.literal("eschatology"),
);

export const vStance = v.union(
  v.literal("affirmed"),
  v.literal("denied"),
  v.literal("uncertain"),
);

export const vStrength = v.union(
  v.literal("settled"),
  v.literal("leaning"),
  v.literal("exploring"),
);

/**
 * The profile shows one position per topic: the latest non-excluded claim.
 * Earlier claims stay in the table as history (Phase 3's development view).
 * Output is newest-first.
 */
export function latestPerTopic<
  T extends { topic: string; createdAt: number; excluded: boolean },
>(positions: T[]): T[] {
  const byTopic = new Map<string, T>();
  for (const position of positions) {
    if (position.excluded) continue;
    const prev = byTopic.get(position.topic);
    if (!prev || position.createdAt > prev.createdAt) {
      byTopic.set(position.topic, position);
    }
  }
  return [...byTopic.values()].sort((a, b) => b.createdAt - a.createdAt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/lib/profile.ts packages/backend/convex/lib/profile.test.ts
git commit -m "feat(backend): theological loci shape — LOCI, stance/strength enums, latestPerTopic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Schema — `positions`, `profileSettings`, conversation extraction fields

**Files:**
- Modify: `packages/backend/convex/schema.ts`
- Test: `packages/backend/convex/profile.test.ts` (create — grows in later tasks)

**Interfaces:**
- Consumes: `vLocus`, `vStance`, `vStrength` from `./lib/profile` (Task 1)
- Produces: tables `positions` (indexes `by_user`, `by_user_locus`, `by_user_topic`), `profileSettings` (index `by_user`); optional `conversations` fields `lastMessageAt: number`, `pendingExtractionId: Id<"_scheduled_functions">`, `lastExtractedOrder: number`.

Design notes locked in here:
- **Append-only positions:** new claims on a topic insert new rows; `_creationTime` orders the history. `latestPerTopic` picks what the page shows.
- **`lastExtractedOrder` replaces the spec's `lastExtractedMessageId`:** the agent component's `MessageDoc.order` is a monotonically increasing per-thread turn number, so a numeric high-water mark makes the delta filter a simple comparison. Same semantics, simpler mechanics.
- **No `sourceMessageId`:** the extraction pass reads a transcript segment, so per-claim message attribution would be LLM-guessed and unreliable. The source link is the conversation (`sourceConversationId`), which the spec's UI actually renders. A misattributed message link is a trust risk; a conversation link is verifiable.
- All new `conversations` fields are `v.optional(...)` — no migration needed for existing rows.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/profile.test.ts`:

```typescript
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("profile schema", () => {
  test("positions and profileSettings rows insert and read back by index", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "user1",
        threadId: "thread1",
        mode: "qa",
        title: "Election",
      });
      await ctx.db.insert("positions", {
        userId: "user1",
        locus: "soteriology",
        topic: "election",
        statement: "Regeneration precedes faith.",
        stance: "affirmed",
        strength: "leaning",
        sourceConversationId: conversationId,
        frameworkAtTime: "reformed",
        excluded: false,
        userEdited: false,
      });
      await ctx.db.insert("profileSettings", {
        userId: "user1",
        optedIn: true,
        paused: false,
        decidedAt: Date.now(),
      });

      const positions = await ctx.db
        .query("positions")
        .withIndex("by_user_locus", (q) =>
          q.eq("userId", "user1").eq("locus", "soteriology"),
        )
        .collect();
      expect(positions).toHaveLength(1);
      expect(positions[0].statement).toBe("Regeneration precedes faith.");

      const settings = await ctx.db
        .query("profileSettings")
        .withIndex("by_user", (q) => q.eq("userId", "user1"))
        .unique();
      expect(settings?.optedIn).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — schema validation error / unknown table `positions`.

- [ ] **Step 3: Extend the schema**

In `packages/backend/convex/schema.ts`, add the import at the top:

```typescript
import { vLocus, vStance, vStrength } from "./lib/profile";
```

Add three optional fields to the existing `conversations` table definition (after `...vSetup,`):

```typescript
  conversations: defineTable({
    userId: v.string(),
    threadId: v.string(),
    mode: vMode,
    title: v.string(),
    ...vSetup,
    // Theological Profile extraction bookkeeping (all optional — pre-profile
    // conversations have none of these).
    lastMessageAt: v.optional(v.number()),
    pendingExtractionId: v.optional(v.id("_scheduled_functions")),
    // Delta high-water mark: agent-component message `order` already extracted.
    lastExtractedOrder: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"]),
```

Add two new tables at the end of the schema (after `usageMonths`):

```typescript
  // Theological Profile — append-only ledger of positions the user has
  // affirmed in their own voice. New claims on a topic append; they never
  // overwrite. docs/THEOLOGICAL_PROFILE.md.
  positions: defineTable({
    userId: v.string(),
    locus: vLocus,
    topic: v.string(), // slug, e.g. "election", "baptismal-efficacy"
    statement: v.string(), // one sentence, user's voice
    stance: vStance,
    strength: vStrength,
    sourceConversationId: v.id("conversations"),
    frameworkAtTime: v.optional(v.string()),
    excluded: v.boolean(), // user hid it from the profile
    userEdited: v.boolean(), // statement hand-edited by the user
  })
    .index("by_user", ["userId"])
    .index("by_user_locus", ["userId", "locus"])
    .index("by_user_topic", ["userId", "topic"]),

  profileSettings: defineTable({
    userId: v.string(),
    optedIn: v.boolean(), // off by default; nothing extracts until true
    paused: v.boolean(), // stops extraction without deleting anything
    decidedAt: v.number(), // ms epoch of the last opt-in/out decision
  }).index("by_user", ["userId"]),
```

- [ ] **Step 4: Run tests to verify pass (including existing suites)**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test`
Expected: PASS — new schema test plus all pre-existing tests (`usage.test.ts`, `lib/*.test.ts`) still green.

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/schema.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): positions + profileSettings tables, conversation extraction bookkeeping

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Extraction prompt, parser, transcript builder — `lib/extraction.ts`

The pure heart of the pipeline. The prompt encodes the spec's hard rule; the parser is fail-closed (anything malformed is dropped, a bad payload yields `[]`).

**Files:**
- Create: `packages/backend/convex/lib/extraction.ts`
- Test: `packages/backend/convex/lib/extraction.test.ts`

**Interfaces:**
- Consumes: `LOCI`, `LOCUS_IDS`, `STANCES`, `STRENGTHS`, types from `./profile`; `getFramework`, `ModeId` from `./studyData`
- Produces:
  - `type ExtractedClaim = { locus: LocusId; topic: string; statement: string; stance: Stance; strength: Strength }`
  - `buildExtractionPrompt(mode: ModeId, framework?: string): string`
  - `parseExtractionResponse(raw: string): ExtractedClaim[]`
  - `normalizeTopic(raw: string): string`
  - `buildTranscript(messages: Array<{ role: string; text?: string }>): string`
  - `MAX_CLAIMS_PER_PASS = 10`

- [ ] **Step 1: Write the failing tests**

Create `packages/backend/convex/lib/extraction.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  buildExtractionPrompt,
  buildTranscript,
  MAX_CLAIMS_PER_PASS,
  normalizeTopic,
  parseExtractionResponse,
} from "./extraction";

describe("buildExtractionPrompt", () => {
  it("states the hard rule and the strict JSON contract", () => {
    const prompt = buildExtractionPrompt("qa", "reformed");
    expect(prompt).toContain("in their own voice");
    expect(prompt).toContain('"claims"');
    expect(prompt).toContain("extract nothing");
    // All eight locus ids are offered as the closed vocabulary.
    expect(prompt).toContain("soteriology");
    expect(prompt).toContain("scripture-revelation");
    // Framework context is resolved to its label.
    expect(prompt).toContain("Reformed");
  });

  it("warns about adversarial transcripts in devils-advocate and debate-prep", () => {
    for (const mode of ["devils-advocate", "debate-prep"] as const) {
      expect(buildExtractionPrompt(mode, "reformed")).toContain("opposing");
    }
    expect(buildExtractionPrompt("qa", "reformed")).not.toContain("ADVERSARIAL");
  });
});

describe("parseExtractionResponse", () => {
  const valid = {
    locus: "soteriology",
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed",
    strength: "leaning",
  };

  it("parses a valid claims payload", () => {
    const out = parseExtractionResponse(JSON.stringify({ claims: [valid] }));
    expect(out).toEqual([valid]);
  });

  it("tolerates a markdown code fence around the JSON", () => {
    const raw = "```json\n" + JSON.stringify({ claims: [valid] }) + "\n```";
    expect(parseExtractionResponse(raw)).toEqual([valid]);
  });

  it("returns [] on malformed JSON or wrong shape", () => {
    expect(parseExtractionResponse("not json")).toEqual([]);
    expect(parseExtractionResponse('{"claims": "nope"}')).toEqual([]);
    expect(parseExtractionResponse('{"other": []}')).toEqual([]);
  });

  it("drops individual invalid claims but keeps valid ones", () => {
    const out = parseExtractionResponse(
      JSON.stringify({
        claims: [
          valid,
          { ...valid, locus: "not-a-locus" },
          { ...valid, stance: "maybe" },
          { ...valid, strength: "rock-solid" },
          { ...valid, statement: "" },
          { ...valid, statement: "x".repeat(400) },
          { ...valid, topic: "" },
          "not an object",
        ],
      }),
    );
    expect(out).toEqual([valid]);
  });

  it("normalizes topics into slugs", () => {
    const out = parseExtractionResponse(
      JSON.stringify({ claims: [{ ...valid, topic: "Baptismal Efficacy!" }] }),
    );
    expect(out[0].topic).toBe("baptismal-efficacy");
  });

  it("caps the number of claims per pass", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...valid,
      topic: `topic-${i}`,
    }));
    const out = parseExtractionResponse(JSON.stringify({ claims: many }));
    expect(out).toHaveLength(MAX_CLAIMS_PER_PASS);
  });
});

describe("normalizeTopic", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(normalizeTopic("  The Extent of the Atonement ")).toBe(
      "the-extent-of-the-atonement",
    );
    expect(normalizeTopic("sola_scriptura?")).toBe("sola-scriptura");
  });
});

describe("buildTranscript", () => {
  it("labels roles and skips empty messages", () => {
    const t = buildTranscript([
      { role: "user", text: "Does baptism save?" },
      { role: "assistant", text: "The tradition answers..." },
      { role: "user", text: "" },
      { role: "user" },
    ]);
    expect(t).toBe("USER: Does baptism save?\n\nASSISTANT: The tradition answers...");
  });

  it("truncates very long individual messages", () => {
    const t = buildTranscript([{ role: "user", text: "y".repeat(10_000) }]);
    expect(t.length).toBeLessThan(6_000);
    expect(t).toContain("[truncated]");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/extraction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/lib/extraction.ts`:

```typescript
import {
  LOCI,
  LOCUS_IDS,
  STANCES,
  STRENGTHS,
  type LocusId,
  type Stance,
  type Strength,
} from "./profile";
import { getFramework, type ModeId } from "./studyData";

export type ExtractedClaim = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
};

export const MAX_CLAIMS_PER_PASS = 10;
const MAX_STATEMENT_CHARS = 300;
const MAX_MESSAGE_CHARS = 4000;

/** Modes where the user deliberately voices positions they do not hold. */
const ADVERSARIAL_MODES: readonly ModeId[] = ["devils-advocate", "debate-prep"];

export function buildExtractionPrompt(mode: ModeId, framework?: string): string {
  const frameworkLabel = framework
    ? (getFramework(framework)?.label ?? framework)
    : "not specified";
  const lociList = LOCI.map((l) => `- ${l.id} (${l.label})`).join("\n");

  const adversarialWarning = ADVERSARIAL_MODES.includes(mode)
    ? `

ADVERSARIAL TRANSCRIPT WARNING. This conversation ran in a debate mode where the assistant argued for an opposing tradition and the user may voice the opposing side to test it. A user restating, steel-manning, or probing an opposing argument is NOT an affirmation. Only extract what the user defends or affirms as genuinely their own — a user defending a position under pressure is a strong affirmation; a user articulating the other side is not one at all. When the two are hard to tell apart, extract nothing.`
    : "";

  return `You extract theological positions a user has personally affirmed in a study conversation.

The transcript below is from a conversation in "${mode}" mode. The user studies within this tradition: ${frameworkLabel}.

THE ONE HARD RULE: extract only what the user affirmed in their own voice. Never extract:
- anything the assistant said, however confidently
- questions the user asked, or topics the user merely studied
- positions the user voiced while representing an opponent's view
- hedged musings that stop short of affirmation

The signal is first-person affirmation: "I hold", "that's my view", "I'd answer that objection by", explicit agreement after a challenge. When in doubt, extract nothing — return an empty claims array. A sparse accurate profile beats a full noisy one.${adversarialWarning}

For each genuine affirmation, produce a claim with:
- "locus": exactly one of these ids (the classical theological loci):
${lociList}
- "topic": a short kebab-case slug for the doctrine (e.g. "election", "baptismal-efficacy")
- "statement": ONE sentence in the user's own voice stating the position (e.g. "Regeneration precedes faith."), under ${MAX_STATEMENT_CHARS} characters
- "stance": "affirmed" | "denied" | "uncertain" — relative to the statement
- "strength": "settled" (stated as conviction) | "leaning" (inclined, some reservation) | "exploring" (trying the position on)

Respond with STRICT JSON only, no prose, no markdown fence:
{"claims": [{"locus": "...", "topic": "...", "statement": "...", "stance": "...", "strength": "..."}]}

If nothing qualifies, respond exactly: {"claims": []}`;
}

export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidClaim(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Fail-closed parser for the extraction response. Malformed payloads yield
 * []; malformed individual claims are dropped. Every misattributed belief is
 * a trust incident, so the bias is always toward extracting less.
 */
export function parseExtractionResponse(raw: string): ExtractedClaim[] {
  let text = raw.trim();
  // Tolerate a model that wraps the JSON in a markdown fence anyway.
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const claims = (parsed as { claims?: unknown }).claims;
  if (!Array.isArray(claims)) return [];

  const out: ExtractedClaim[] = [];
  for (const candidate of claims) {
    if (out.length >= MAX_CLAIMS_PER_PASS) break;
    if (!isValidClaim(candidate)) continue;
    const { locus, topic, statement, stance, strength } = candidate;
    if (typeof locus !== "string" || !(LOCUS_IDS as readonly string[]).includes(locus)) continue;
    if (typeof stance !== "string" || !(STANCES as readonly string[]).includes(stance)) continue;
    if (typeof strength !== "string" || !(STRENGTHS as readonly string[]).includes(strength)) continue;
    if (typeof statement !== "string") continue;
    const trimmedStatement = statement.trim();
    if (!trimmedStatement || trimmedStatement.length > MAX_STATEMENT_CHARS) continue;
    if (typeof topic !== "string") continue;
    const slug = normalizeTopic(topic);
    if (!slug) continue;
    out.push({
      locus: locus as LocusId,
      topic: slug,
      statement: trimmedStatement,
      stance: stance as Stance,
      strength: strength as Strength,
    });
  }
  return out;
}

/** Role-labeled plain-text transcript for the extraction pass. */
export function buildTranscript(
  messages: Array<{ role: string; text?: string }>,
): string {
  const parts: string[] = [];
  for (const message of messages) {
    const text = message.text?.trim();
    if (!text) continue;
    const clipped =
      text.length > MAX_MESSAGE_CHARS
        ? `${text.slice(0, MAX_MESSAGE_CHARS)} [truncated]`
        : text;
    parts.push(`${message.role.toUpperCase()}: ${clipped}`);
  }
  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/extraction.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/lib/extraction.ts packages/backend/convex/lib/extraction.test.ts
git commit -m "feat(backend): extraction prompt, fail-closed claim parser, transcript builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Markdown export builder — `lib/profile-export.ts`

**Files:**
- Create: `packages/backend/convex/lib/profile-export.ts`
- Test: `packages/backend/convex/lib/profile-export.test.ts`

**Interfaces:**
- Consumes: `LOCI`, `type LocusId`, `type Stance`, `type Strength` from `./profile`
- Produces:
  - `type ExportPosition = { locus: LocusId; topic: string; statement: string; stance: Stance; strength: Strength; frameworkLabel?: string; createdAt: number }`
  - `buildProfileMarkdown(positions: ExportPosition[], generatedAt: number): string`

The caller (Task 5's `exportProfile` query) resolves framework slugs to labels and applies `latestPerTopic` before calling — this builder just renders.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/lib/profile-export.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { buildProfileMarkdown, type ExportPosition } from "./profile-export";

const at = Date.UTC(2026, 2, 14); // 2026-03-14

const position = (over: Partial<ExportPosition> = {}): ExportPosition => ({
  locus: "soteriology",
  topic: "election",
  statement: "Regeneration precedes faith.",
  stance: "affirmed",
  strength: "settled",
  frameworkLabel: "Reformed",
  createdAt: at,
  ...over,
});

describe("buildProfileMarkdown", () => {
  it("renders loci in canonical order with statements and apparatus", () => {
    const md = buildProfileMarkdown(
      [
        position(),
        position({
          locus: "christology",
          topic: "two-natures",
          statement: "Christ is one person in two natures.",
        }),
      ],
      at,
    );
    expect(md).toContain("# Your Theology");
    expect(md).toContain("2026-03-14");
    // Christology precedes Soteriology in the canonical order.
    expect(md.indexOf("## Christology")).toBeLessThan(md.indexOf("## Soteriology"));
    expect(md).toContain("**Regeneration precedes faith.**");
    expect(md).toContain("affirmed · settled · Reformed · 2026-03-14");
  });

  it("omits loci with no positions and handles a missing framework", () => {
    const md = buildProfileMarkdown([position({ frameworkLabel: undefined })], at);
    expect(md).not.toContain("## Eschatology");
    expect(md).toContain("affirmed · settled · 2026-03-14");
  });

  it("renders an honest empty confession", () => {
    const md = buildProfileMarkdown([], at);
    expect(md).toContain("# Your Theology");
    expect(md).toContain("No positions recorded yet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profile-export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/lib/profile-export.ts`:

```typescript
import { LOCI, type LocusId, type Stance, type Strength } from "./profile";

export type ExportPosition = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
  frameworkLabel?: string;
  createdAt: number;
};

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The user's confession as a portable markdown document. It's their
 * confession — they should be able to keep it (docs/THEOLOGICAL_PROFILE.md,
 * User control).
 */
export function buildProfileMarkdown(
  positions: ExportPosition[],
  generatedAt: number,
): string {
  const lines: string[] = [
    "# Your Theology",
    "",
    `> Exported from Theologia on ${isoDate(generatedAt)}. Assembled from positions you affirmed in your own study conversations.`,
    "",
  ];

  if (positions.length === 0) {
    lines.push("_No positions recorded yet — this document grows as you study._", "");
    return lines.join("\n");
  }

  for (const locus of LOCI) {
    const inLocus = positions.filter((p) => p.locus === locus.id);
    if (inLocus.length === 0) continue;
    lines.push(`## ${locus.label}`, "");
    for (const p of inLocus) {
      const apparatus = [p.stance, p.strength, p.frameworkLabel, isoDate(p.createdAt)]
        .filter(Boolean)
        .join(" · ");
      lines.push(`**${p.statement}**`, "", `*${apparatus}*`, "");
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profile-export.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/lib/profile-export.ts packages/backend/convex/lib/profile-export.test.ts
git commit -m "feat(backend): markdown confession export builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Profile Convex functions — settings, position controls, getProfile, export

Public functions are thin auth shells over exported plain helpers (`settingsForUser`, `assertOwnPosition`) so `convex-test` can exercise the logic via `t.run`.

**Files:**
- Create: `packages/backend/convex/profile.ts`
- Modify (extend): `packages/backend/convex/profile.test.ts`

**Interfaces:**
- Consumes: `authComponent` from `./auth`; `getPlanIdForUser` from `./polar`; `latestPerTopic`, validators from `./lib/profile`; `buildProfileMarkdown` from `./lib/profile-export`; `getFramework` from `./lib/studyData`
- Produces (public API, all auth-gated):
  - `api.profile.getProfile` — `{}` → `null | { planId, optedIn, paused, positions: PositionView[] }` where `PositionView = { id, locus, topic, statement, stance, strength, frameworkAtTime, sourceConversationId, createdAt, userEdited }` (latest per topic, excluded hidden; `positions` is `[]` when free or not opted in)
  - `api.profile.setOptIn` — `{ optedIn: boolean }`
  - `api.profile.setPaused` — `{ paused: boolean }`
  - `api.profile.editPosition` — `{ positionId: Id<"positions">, statement: string }`
  - `api.profile.excludePosition` — `{ positionId, excluded: boolean }`
  - `api.profile.deletePosition` — `{ positionId }`
  - `api.profile.deleteAllProfileData` — `{}`
  - `api.profile.exportProfile` — `{}` → `string` (markdown)
- Produces (helpers, used by Task 6):
  - `settingsForUser(ctx, userId)` → `Doc<"profileSettings"> | null`
  - `upsertSettings(ctx, userId, patch: { optedIn?: boolean; paused?: boolean })`

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/profile.test.ts` (keep the Task 2 describe block):

```typescript
import { upsertSettings, settingsForUser } from "./profile";
import { latestPerTopic } from "./lib/profile";

describe("profile settings helpers", () => {
  test("upsertSettings creates then updates a single row", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      expect(await settingsForUser(ctx as never, "u1")).toBeNull();

      await upsertSettings(ctx as never, "u1", { optedIn: true });
      let settings = await settingsForUser(ctx as never, "u1");
      expect(settings).toMatchObject({ optedIn: true, paused: false });

      await upsertSettings(ctx as never, "u1", { paused: true });
      settings = await settingsForUser(ctx as never, "u1");
      expect(settings).toMatchObject({ optedIn: true, paused: true });

      const rows = await ctx.db.query("profileSettings").collect();
      expect(rows).toHaveLength(1);
    });
  });
});

describe("position selection", () => {
  test("getProfile-style read: latest per topic, excluded hidden", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      const base = {
        userId: "u1",
        locus: "soteriology" as const,
        statement: "s",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      await ctx.db.insert("positions", { ...base, topic: "election", statement: "old" });
      await ctx.db.insert("positions", { ...base, topic: "election", statement: "new" });
      await ctx.db.insert("positions", { ...base, topic: "atonement", excluded: true });

      const docs = await ctx.db
        .query("positions")
        .withIndex("by_user", (q) => q.eq("userId", "u1"))
        .collect();
      const visible = latestPerTopic(
        docs.map((d) => ({ ...d, createdAt: d._creationTime })),
      );
      expect(visible).toHaveLength(1);
      expect(visible[0].statement).toBe("new");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — `./profile` (the convex module) doesn't exist yet / named exports missing.

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/profile.ts`:

```typescript
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { latestPerTopic } from "./lib/profile";
import { buildProfileMarkdown, type ExportPosition } from "./lib/profile-export";
import { getFramework } from "./lib/studyData";
import { getPlanIdForUser } from "./polar";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function settingsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"profileSettings"> | null> {
  return await ctx.db
    .query("profileSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function upsertSettings(
  ctx: MutationCtx,
  userId: string,
  patch: { optedIn?: boolean; paused?: boolean },
): Promise<void> {
  const existing = await settingsForUser(ctx, userId);
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, decidedAt: Date.now() });
  } else {
    await ctx.db.insert("profileSettings", {
      userId,
      optedIn: patch.optedIn ?? false,
      paused: patch.paused ?? false,
      decidedAt: Date.now(),
    });
  }
}

async function assertOwnPosition(
  ctx: MutationCtx,
  userId: string,
  positionId: Id<"positions">,
): Promise<Doc<"positions">> {
  const position = await ctx.db.get(positionId);
  if (!position || position.userId !== userId) {
    throw new Error("Position not found");
  }
  return position;
}

function toPositionView(doc: Doc<"positions">) {
  return {
    id: doc._id,
    locus: doc.locus,
    topic: doc.topic,
    statement: doc.statement,
    stance: doc.stance,
    strength: doc.strength,
    frameworkAtTime: doc.frameworkAtTime,
    sourceConversationId: doc.sourceConversationId,
    createdAt: doc._creationTime,
    userEdited: doc.userEdited,
    excluded: doc.excluded,
  };
}

async function visiblePositions(ctx: QueryCtx, userId: string) {
  const docs = await ctx.db
    .query("positions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return latestPerTopic(docs.map(toPositionView));
}

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const planId = await getPlanIdForUser(ctx, user._id);
    const settings = await settingsForUser(ctx, user._id);
    const optedIn = settings?.optedIn ?? false;
    const paused = settings?.paused ?? false;
    if (planId === "free" || !optedIn) {
      return { planId, optedIn, paused, positions: [] };
    }
    return {
      planId,
      optedIn,
      paused,
      positions: await visiblePositions(ctx, user._id),
    };
  },
});

export const setOptIn = mutation({
  args: { optedIn: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertSettings(ctx, user._id, { optedIn: args.optedIn });
  },
});

export const setPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertSettings(ctx, user._id, { paused: args.paused });
  },
});

export const editPosition = mutation({
  args: { positionId: v.id("positions"), statement: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    const statement = args.statement.trim();
    if (!statement) throw new Error("Statement is empty");
    await ctx.db.patch(args.positionId, { statement, userEdited: true });
  },
});

export const excludePosition = mutation({
  args: { positionId: v.id("positions"), excluded: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    await ctx.db.patch(args.positionId, { excluded: args.excluded });
  },
});

export const deletePosition = mutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    await ctx.db.delete(args.positionId);
  },
});

/** One-click delete-everything: positions and settings, back to never-opted-in. */
export const deleteAllProfileData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const position of positions) {
      await ctx.db.delete(position._id);
    }
    const settings = await settingsForUser(ctx, user._id);
    if (settings) await ctx.db.delete(settings._id);
  },
});

export const exportProfile = query({
  args: {},
  handler: async (ctx): Promise<string> => {
    const user = await requireUser(ctx);
    const positions = await visiblePositions(ctx, user._id);
    const exportPositions: ExportPosition[] = positions.map((p) => ({
      locus: p.locus,
      topic: p.topic,
      statement: p.statement,
      stance: p.stance,
      strength: p.strength,
      frameworkLabel: p.frameworkAtTime
        ? (getFramework(p.frameworkAtTime)?.label ?? p.frameworkAtTime)
        : undefined,
      createdAt: p.createdAt,
    }));
    return buildProfileMarkdown(exportPositions, Date.now());
  },
});
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test`
Expected: PASS — all suites.

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): profile settings, position controls, getProfile and export queries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Extraction pipeline — debounced scheduling + Haiku extraction action

**Files:**
- Modify: `packages/backend/convex/profile.ts` (add scheduling helper, internal query/mutations, action)
- Modify: `packages/backend/convex/chat.ts` (wire scheduling into `createConversation` and `sendMessage`)
- Modify (extend): `packages/backend/convex/profile.test.ts`

**Interfaces:**
- Consumes: `listMessages` from `@convex-dev/agent` (signature: `listMessages(ctx, components.agent, { threadId, paginationOpts, excludeToolMessages }) => Promise<PaginationResult<MessageDoc>>`; `MessageDoc` has `_id`, `order: number`, `stepOrder: number`, `message?: { role, content }`, `text?: string`, `tool: boolean`); `generateText` + `anthropic` from `ai` / `@ai-sdk/anthropic`; `buildExtractionPrompt`, `parseExtractionResponse`, `buildTranscript`, `ExtractedClaim` from `./lib/extraction`; `PlanId` from `./lib/plans`
- Produces:
  - `scheduleExtraction(ctx: MutationCtx, args: { conversationId: Id<"conversations">; userId: string; planId: PlanId }): Promise<void>` — exported plain helper, called from chat mutations
  - `internal.profile.extractPositions` internalAction `{ conversationId: Id<"conversations"> }`
  - `internal.profile.getExtractionContext` internalQuery
  - `internal.profile.recordExtraction` internalMutation `{ conversationId, userId, claims, lastExtractedOrder }`
  - `internal.profile.clearPendingExtraction` internalMutation `{ conversationId }`
  - `EXTRACTION_IDLE_MS = 30 * 60 * 1000`

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/profile.test.ts`:

```typescript
import { internal } from "./_generated/api";
import { scheduleExtraction } from "./profile";

describe("scheduleExtraction", () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      return conversationId;
    });
  }

  test("does nothing for free plan or when not opted in or paused", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await seed(t);
    await t.run(async (ctx) => {
      // Never opted in.
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();

      const { upsertSettings } = await import("./profile");
      await upsertSettings(ctx as never, "u1", { optedIn: true });

      // Free plan.
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "free" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();

      // Paused.
      await upsertSettings(ctx as never, "u1", { paused: true });
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();
    });
  });

  test("schedules a job, and reschedules (cancelling the prior job) on the next message", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await seed(t);
    await t.run(async (ctx) => {
      const { upsertSettings } = await import("./profile");
      await upsertSettings(ctx as never, "u1", { optedIn: true });

      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      const first = (await ctx.db.get(conversationId))?.pendingExtractionId;
      expect(first).toBeDefined();

      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      const second = (await ctx.db.get(conversationId))?.pendingExtractionId;
      expect(second).toBeDefined();
      expect(second).not.toEqual(first);

      const firstJob = await ctx.db.system.get(first!);
      expect(firstJob?.state.kind).toBe("canceled");
      expect((await ctx.db.get(conversationId))?.lastMessageAt).toBeTypeOf("number");
    });
  });
});

describe("recordExtraction", () => {
  test("inserts claims, advances the high-water mark, clears the pending id", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await t.run(async (ctx) =>
      ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
        framework: "reformed",
      }),
    );

    await t.mutation(internal.profile.recordExtraction, {
      conversationId,
      userId: "u1",
      lastExtractedOrder: 4,
      claims: [
        {
          locus: "soteriology",
          topic: "election",
          statement: "Regeneration precedes faith.",
          stance: "affirmed",
          strength: "leaning",
        },
      ],
    });

    await t.run(async (ctx) => {
      const positions = await ctx.db.query("positions").collect();
      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        userId: "u1",
        locus: "soteriology",
        topic: "election",
        frameworkAtTime: "reformed",
        excluded: false,
        userEdited: false,
        sourceConversationId: conversationId,
      });
      const conversation = await ctx.db.get(conversationId);
      expect(conversation?.lastExtractedOrder).toBe(4);
      expect(conversation?.pendingExtractionId).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — `scheduleExtraction` / `internal.profile.recordExtraction` don't exist.

- [ ] **Step 3: Implement the pipeline in `convex/profile.ts`**

Add imports at the top of `packages/backend/convex/profile.ts`:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { listMessages } from "@convex-dev/agent";
import { generateText } from "ai";

import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  buildExtractionPrompt,
  buildTranscript,
  parseExtractionResponse,
} from "./lib/extraction";
import { vLocus, vStance, vStrength } from "./lib/profile";
import type { PlanId } from "./lib/plans";
```

(Merge with the existing import lines from Task 5 — `mutation`, `query`, ctx types, etc. stay.)

Add the pipeline code:

```typescript
export const EXTRACTION_IDLE_MS = 30 * 60 * 1000; // spec: ~30 minutes idle

/**
 * Debounced extraction scheduling. Called after every saved user message:
 * cancels the conversation's pending extraction job (if any) and schedules a
 * fresh one EXTRACTION_IDLE_MS out, so extraction runs once per idle period.
 * planId is passed in because the chat mutations have already resolved it.
 */
export async function scheduleExtraction(
  ctx: MutationCtx,
  args: {
    conversationId: Id<"conversations">;
    userId: string;
    planId: PlanId;
  },
): Promise<void> {
  if (args.planId === "free") return;
  const settings = await settingsForUser(ctx, args.userId);
  if (!settings?.optedIn || settings.paused) return;

  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation) return;
  if (conversation.pendingExtractionId) {
    await ctx.scheduler.cancel(conversation.pendingExtractionId);
  }
  const jobId = await ctx.scheduler.runAfter(
    EXTRACTION_IDLE_MS,
    internal.profile.extractPositions,
    { conversationId: args.conversationId },
  );
  await ctx.db.patch(args.conversationId, {
    pendingExtractionId: jobId,
    lastMessageAt: Date.now(),
  });
}

export const getExtractionContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    const settings = await settingsForUser(ctx, conversation.userId);
    return {
      userId: conversation.userId,
      threadId: conversation.threadId,
      mode: conversation.mode,
      framework: conversation.framework,
      lastExtractedOrder: conversation.lastExtractedOrder ?? -1,
      eligible: (settings?.optedIn ?? false) && !(settings?.paused ?? false),
    };
  },
});

const vClaim = v.object({
  locus: vLocus,
  topic: v.string(),
  statement: v.string(),
  stance: vStance,
  strength: vStrength,
});

export const recordExtraction = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    claims: v.array(vClaim),
    lastExtractedOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    for (const claim of args.claims) {
      await ctx.db.insert("positions", {
        userId: args.userId,
        ...claim,
        sourceConversationId: args.conversationId,
        frameworkAtTime: conversation.framework,
        excluded: false,
        userEdited: false,
      });
    }
    await ctx.db.patch(args.conversationId, {
      lastExtractedOrder: args.lastExtractedOrder,
      pendingExtractionId: undefined,
    });
  },
});

export const clearPendingExtraction = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    await ctx.db.patch(args.conversationId, { pendingExtractionId: undefined });
  },
});

/**
 * The extraction pass (docs/THEOLOGICAL_PROFILE.md §How It Works). Runs one
 * Haiku call over the new transcript segment; any failure extracts nothing
 * (fail closed) but always clears the pending-job marker.
 */
export const extractPositions = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.profile.getExtractionContext, {
      conversationId: args.conversationId,
    });
    if (!context) return;

    try {
      // Re-check eligibility: the user may have paused or opted out (or
      // downgraded) during the idle window.
      const planId = await getPlanIdForUser(ctx, context.userId);
      if (planId === "free" || !context.eligible) {
        await ctx.runMutation(internal.profile.clearPendingExtraction, {
          conversationId: args.conversationId,
        });
        return;
      }

      const page = await listMessages(ctx, components.agent, {
        threadId: context.threadId,
        paginationOpts: { numItems: 200, cursor: null },
        excludeToolMessages: true,
      });
      const newSegment = page.page
        .filter((m) => m.order > context.lastExtractedOrder)
        .sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder);
      const hasNewUserTurn = newSegment.some(
        (m) => m.message?.role === "user" && (m.text?.trim() ?? "") !== "",
      );
      if (!hasNewUserTurn) {
        await ctx.runMutation(internal.profile.clearPendingExtraction, {
          conversationId: args.conversationId,
        });
        return;
      }

      const transcript = buildTranscript(
        newSegment.map((m) => ({
          role: m.message?.role ?? "assistant",
          text: m.text,
        })),
      );
      const result = await generateText({
        model: anthropic("claude-haiku-4-5"),
        system: buildExtractionPrompt(context.mode, context.framework),
        prompt: transcript,
        maxOutputTokens: 2000,
      });
      const claims = parseExtractionResponse(result.text);

      const lastExtractedOrder = Math.max(
        ...newSegment.map((m) => m.order),
        context.lastExtractedOrder,
      );
      await ctx.runMutation(internal.profile.recordExtraction, {
        conversationId: args.conversationId,
        userId: context.userId,
        claims,
        lastExtractedOrder,
      });
    } catch (error) {
      console.error("extractPositions failed", error);
      await ctx.runMutation(internal.profile.clearPendingExtraction, {
        conversationId: args.conversationId,
      });
    }
  },
});
```

- [ ] **Step 4: Wire scheduling into `chat.ts`**

In `packages/backend/convex/chat.ts`, add the import:

```typescript
import { scheduleExtraction } from "./profile";
```

In `createConversation`, immediately before `return conversationId;` (after the `streamReply` scheduling), add:

```typescript
    await scheduleExtraction(ctx, {
      conversationId,
      userId: user._id,
      planId,
    });
```

In `sendMessage`, at the end of the handler (after the `streamReply` scheduling), add:

```typescript
    await scheduleExtraction(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
      planId,
    });
```

(Both handlers already have `planId` in scope from `getPlanIdForUser`.)

- [ ] **Step 5: Run the full backend suite**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test`
Expected: PASS — all suites including the new `scheduleExtraction` and `recordExtraction` tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/profile.ts packages/backend/convex/chat.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): debounced Haiku extraction pipeline wired into chat mutations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `/profile` page — "Your Theology"

Manuscript-register page with four states (free-locked / opt-in card / empty scaffolding / populated) and all user controls. Also: `ChatApp` learns to open a conversation from a `?c=` query param so position source links work.

**Files:**
- Create: `apps/web/src/app/profile/page.tsx`
- Create: `apps/web/src/components/profile/profile-page.tsx`
- Create: `apps/web/src/components/profile/profile-page.module.css`
- Modify: `apps/web/src/components/chat/chat-app.tsx` (initial `activeId` from `?c=`)

**Interfaces:**
- Consumes: `api.profile.*` (Task 5), `LOCI` + `getLocusLabel` from `@theologia/backend/convex/lib/profile`, `getFramework` from `@theologia/backend/convex/lib/studyData`, existing `Loader`, auth wrapper pattern from `app/chat/page.tsx`
- Produces: route `/profile`; `ChatApp` honors `/chat?c=<conversationId>`

- [ ] **Step 1: Route shell**

Create `apps/web/src/app/profile/page.tsx` (mirrors `app/chat/page.tsx`):

```tsx
"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthLayout from "@/components/auth-layout";
import authStyles from "@/components/auth-layout.module.css";
import Loader from "@/components/loader";
import ProfilePage from "@/components/profile/profile-page";
import SignInForm from "@/components/sign-in-form";

export default function Profile() {
  return (
    <>
      <Authenticated>
        <ProfilePage />
      </Authenticated>
      <Unauthenticated>
        <AuthLayout>
          <h1 className={authStyles.cardTitle}>Welcome back</h1>
          <SignInForm />
        </AuthLayout>
      </Unauthenticated>
      <AuthLoading>
        <Loader />
      </AuthLoading>
    </>
  );
}
```

- [ ] **Step 2: Profile component**

Create `apps/web/src/components/profile/profile-page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { getLocusLabel, LOCI } from "@theologia/backend/convex/lib/profile";
import { getFramework } from "@theologia/backend/convex/lib/studyData";
import { useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import Loader from "@/components/loader";

import styles from "./profile-page.module.css";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const profile = useQuery(api.profile.getProfile);
  const setOptIn = useMutation(api.profile.setOptIn);
  const setPaused = useMutation(api.profile.setPaused);
  const editPosition = useMutation(api.profile.editPosition);
  const excludePosition = useMutation(api.profile.excludePosition);
  const deletePosition = useMutation(api.profile.deletePosition);
  const deleteAll = useMutation(api.profile.deleteAllProfileData);
  const convex = useConvex();

  const [editingId, setEditingId] = useState<Id<"positions"> | null>(null);
  const [draft, setDraft] = useState("");

  if (profile === undefined) return <Loader />;
  if (profile === null) return null;

  const isFree = profile.planId === "free";

  async function handleExport() {
    const markdown = await convex.query(api.profile.exportProfile, {});
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "your-theology.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAll() {
    const ok = window.confirm(
      "Delete your entire theological profile? Every recorded position is removed permanently. This cannot be undone.",
    );
    if (!ok) return;
    await deleteAll({});
    toast.success("Your profile has been deleted.");
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/chat" className={styles.backLink}>
          ← Back to study
        </Link>
        <p className={styles.eyebrow}>Your Theology</p>
        <h1 className={styles.title}>
          A confession, <em>written by your own study</em>
        </h1>
        <p className={styles.lede}>
          Positions you have affirmed across your conversations, organized by
          the classical loci and sourced back to the study where you took
          them. Yours to edit, export, or erase — never shared, never used in
          marketing, never used to train models.
        </p>
      </header>

      {isFree ? (
        <LockedPreview />
      ) : !profile.optedIn ? (
        <OptInCard onOptIn={() => setOptIn({ optedIn: true })} />
      ) : (
        <>
          <div className={styles.controls}>
            <label className={styles.pauseControl}>
              <input
                type="checkbox"
                checked={profile.paused}
                onChange={(e) => setPaused({ paused: e.target.checked })}
              />
              Pause tracking
            </label>
            <button type="button" className={styles.controlButton} onClick={handleExport}>
              Export as markdown
            </button>
            <button type="button" className={styles.dangerButton} onClick={handleDeleteAll}>
              Delete everything
            </button>
          </div>

          <main className={styles.loci}>
            {LOCI.map((locus) => {
              const positions = profile.positions.filter((p) => p.locus === locus.id);
              return (
                <section key={locus.id} className={styles.locus}>
                  <h2
                    className={
                      positions.length === 0 ? styles.locusLabelEmpty : styles.locusLabel
                    }
                  >
                    {locus.label}
                  </h2>
                  {positions.length === 0 ? (
                    <p className={styles.emptyLocus}>Nothing recorded yet.</p>
                  ) : (
                    positions.map((position) => (
                      <article key={position.id} className={styles.position}>
                        {editingId === position.id ? (
                          <div className={styles.editRow}>
                            <textarea
                              className={styles.editArea}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              rows={2}
                            />
                            <div className={styles.positionActions}>
                              <button
                                type="button"
                                className={styles.controlButton}
                                onClick={async () => {
                                  await editPosition({
                                    positionId: position.id,
                                    statement: draft,
                                  });
                                  setEditingId(null);
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className={styles.controlButton}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={styles.statement}>{position.statement}</p>
                        )}
                        <p className={styles.apparatus}>
                          {[
                            position.stance,
                            position.strength,
                            position.frameworkAtTime
                              ? (getFramework(position.frameworkAtTime)?.label ??
                                position.frameworkAtTime)
                              : null,
                            formatDate(position.createdAt),
                            position.userEdited ? "edited" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {" · "}
                          <Link
                            href={`/chat?c=${position.sourceConversationId}`}
                            className={styles.sourceLink}
                          >
                            source conversation
                          </Link>
                        </p>
                        {editingId !== position.id && (
                          <div className={styles.positionActions}>
                            <button
                              type="button"
                              className={styles.quietButton}
                              onClick={() => {
                                setEditingId(position.id);
                                setDraft(position.statement);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={styles.quietButton}
                              onClick={() =>
                                excludePosition({ positionId: position.id, excluded: true })
                              }
                            >
                              Exclude
                            </button>
                            <button
                              type="button"
                              className={styles.quietButton}
                              onClick={() => deletePosition({ positionId: position.id })}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </main>
        </>
      )}
    </div>
  );
}

function LockedPreview() {
  return (
    <div className={styles.lockedWrap}>
      <p className={styles.lockedCopy}>
        Your Theology is part of the Scholar plan. As you study, Theologia
        assembles the positions you affirm into a living confession — each one
        dated, sourced to its conversation, and entirely under your control.
      </p>
      <div className={styles.lociLocked} aria-hidden="true">
        {LOCI.map((locus) => (
          <section key={locus.id} className={styles.locus}>
            <h2 className={styles.locusLabelEmpty}>{locus.label}</h2>
            <p className={styles.emptyLocus}>Fills in as you study.</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function OptInCard({ onOptIn }: { onOptIn: () => void }) {
  return (
    <div className={styles.optInCard}>
      <h2 className={styles.optInTitle}>Keep a record of what you believe?</h2>
      <p className={styles.optInCopy}>
        With your permission, Theologia will read your finished conversations
        and record the theological positions you affirm in your own words —
        one sentence each, dated, and linked to the conversation where you
        took them. Only what you yourself affirm is recorded; never the
        assistant&apos;s views, never positions you argue against for
        practice. Everything is editable and deletable, you can pause or
        export at any time, and your profile is never shared with anyone,
        never used in marketing, and never used to train models.
      </p>
      <button type="button" className={styles.optInButton} onClick={onOptIn}>
        Begin my profile
      </button>
      <p className={styles.optInFootnote}>Off by default. You can turn this off or delete everything at any time.</p>
    </div>
  );
}
```

- [ ] **Step 3: CSS module (manuscript register)**

Create `apps/web/src/components/profile/profile-page.module.css`:

```css
/* Your Theology — the critical-edition register from DESIGN.md.
   Fraunces statements, Geist Mono apparatus, hairline rules between loci. */

.root {
  --ink: #14100a;
  --ink-deep: #0b0805;
  --parchment: #f1e8d6;
  --parchment-dim: #b9a886;
  --stone: #8a7d68;
  --gold: #c9a24e;
  --gold-bright: #e6c984;
  --hairline: rgba(201, 162, 78, 0.26);
  --error: #c0392b;

  min-height: 100vh;
  background: var(--ink-deep);
  color: var(--parchment);
  padding: clamp(2rem, 5vw, 4.5rem) clamp(1.25rem, 6vw, 5rem);
  max-width: 60rem;
  margin: 0 auto;
}

.header {
  border-bottom: 1px solid var(--hairline);
  padding-bottom: 2rem;
  margin-bottom: 2.5rem;
}

.backLink {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--stone);
  text-decoration: none;
}
.backLink:hover { color: var(--gold); }

.eyebrow {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold);
  margin: 2rem 0 0.9rem;
}
.eyebrow::before {
  content: "";
  display: inline-block;
  width: 2.2rem;
  height: 1px;
  background: var(--gold);
  vertical-align: middle;
  margin-right: 0.7rem;
}

.title {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 370;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0 0 1rem;
}
.title em {
  font-style: italic;
  font-weight: 400;
  color: var(--gold-bright);
}

.lede {
  font-family: var(--font-inter), sans-serif;
  font-size: clamp(0.95rem, 1.3vw, 1.08rem);
  line-height: 1.6;
  color: var(--parchment-dim);
  max-width: 44rem;
  margin: 0;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.pauseControl {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--parchment-dim);
  cursor: pointer;
}
.pauseControl input { accent-color: var(--gold); }

.controlButton,
.quietButton,
.dangerButton,
.optInButton {
  font-family: var(--font-geist-mono), monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  cursor: pointer;
}

.controlButton {
  font-size: 0.68rem;
  color: var(--parchment-dim);
  padding: 0.45rem 0.8rem;
}
.controlButton:hover { color: var(--gold-bright); border-color: var(--gold); }

.dangerButton {
  font-size: 0.68rem;
  color: var(--error);
  border-color: rgba(192, 57, 43, 0.4);
  padding: 0.45rem 0.8rem;
  margin-left: auto;
}
.dangerButton:hover { border-color: var(--error); }

.loci { display: flex; flex-direction: column; }

.locus {
  border-bottom: 1px solid var(--hairline);
  padding: 1.6rem 0;
}
.locus:last-child { border-bottom: none; }

.locusLabel,
.locusLabelEmpty {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 1rem;
}
.locusLabel { color: var(--gold); }
.locusLabelEmpty { color: var(--stone); opacity: 0.7; }

.emptyLocus {
  font-family: var(--font-inter), sans-serif;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--stone);
  margin: 0;
}

.position { margin-bottom: 1.5rem; }
.position:last-child { margin-bottom: 0; }

.statement {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-size: clamp(1.1rem, 1.8vw, 1.35rem);
  line-height: 1.35;
  color: var(--parchment);
  margin: 0 0 0.4rem;
}

.apparatus {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--stone);
  margin: 0 0 0.45rem;
}

.sourceLink { color: var(--gold); text-decoration: none; }
.sourceLink:hover { color: var(--gold-bright); text-decoration: underline; }

.positionActions { display: flex; gap: 0.5rem; }

.quietButton {
  font-size: 0.62rem;
  color: var(--stone);
  border-color: transparent;
  padding: 0.25rem 0.4rem;
}
.quietButton:hover { color: var(--gold-bright); border-color: var(--hairline); }

.editRow { margin-bottom: 0.5rem; }
.editArea {
  width: 100%;
  font-family: var(--font-fraunces), serif;
  font-size: 1.1rem;
  color: var(--parchment);
  background: rgba(11, 8, 5, 0.6);
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.6rem;
  margin-bottom: 0.5rem;
  resize: vertical;
}

.lockedWrap { position: relative; }
.lockedCopy {
  font-family: var(--font-inter), sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--parchment-dim);
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 1.5rem;
  margin-bottom: 2.5rem;
  max-width: 44rem;
}
.lociLocked { opacity: 0.45; pointer-events: none; }

.optInCard {
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  max-width: 44rem;
}
.optInTitle {
  font-family: var(--font-fraunces), serif;
  font-weight: 400;
  font-size: 1.5rem;
  margin: 0 0 1rem;
}
.optInCopy {
  font-family: var(--font-inter), sans-serif;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--parchment-dim);
  margin: 0 0 1.5rem;
}
.optInButton {
  font-size: 0.78rem;
  font-weight: 600;
  color: #1a1206;
  background: var(--gold);
  border-color: var(--gold);
  padding: 0.7rem 1.2rem;
}
.optInButton:hover { background: var(--gold-bright); }
.optInFootnote {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--stone);
  margin: 0.9rem 0 0;
}
```

- [ ] **Step 4: `?c=` deep link into ChatApp**

In `apps/web/src/components/chat/chat-app.tsx`, change the `activeId` initializer:

```tsx
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("c"),
  );
```

(A lazy `useState` initializer reading `window.location` avoids the Next.js `useSearchParams` Suspense requirement; the page is client-only behind auth anyway.)

- [ ] **Step 5: Verify types build**

Run: `cd /Users/dylanwest/Coding/theologia && bun run check-types`
Expected: PASS. If the web package lacks a `check-types` script, run `cd apps/web && bunx tsc --noEmit` instead.

If importing `@theologia/backend/convex/lib/profile` from the web app fails to resolve, mirror how existing web code imports backend modules (`@theologia/backend/convex/_generated/api`) — the path form must match; do not copy the LOCI array into the web app.

- [ ] **Step 6: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/app/profile/page.tsx apps/web/src/components/profile/ apps/web/src/components/chat/chat-app.tsx
git commit -m "feat(web): /profile page — Your Theology with opt-in, controls, export, locked preview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Sidebar navigation + end-to-end verification

**Files:**
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`
- Modify: `apps/web/src/components/chat/chat-sidebar.module.css`

**Interfaces:**
- Consumes: route `/profile` (Task 7), existing sidebar structure
- Produces: a "Your Theology" nav link in the chat sidebar footer

- [ ] **Step 1: Add the nav link**

In `apps/web/src/components/chat/chat-sidebar.tsx`, inside `<div className={styles.footer}>`, above `<UserMenu />`:

```tsx
      <div className={styles.footer}>
        <Link href="/profile" className={styles.profileLink}>
          Your Theology
        </Link>
        <UserMenu />
      </div>
```

In `apps/web/src/components/chat/chat-sidebar.module.css`, add (near the `.footer` rules):

```css
.profileLink {
  display: block;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--stone, #8a7d68);
  text-decoration: none;
  padding: 0.5rem 0;
}
.profileLink:hover { color: var(--gold, #c9a24e); }
.profileLink:focus-visible {
  outline: 1px solid var(--gold, #c9a24e);
  outline-offset: 3px;
}
```

(If `.footer` has layout that needs adjusting for two children, match its existing padding/gap conventions.)

- [ ] **Step 2: Full verification**

```bash
cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test
cd /Users/dylanwest/Coding/theologia && bun run check-types
```

Expected: all backend tests PASS; type check PASS.

- [ ] **Step 3: Manual smoke test (dev deployment)**

With `bun run dev` running (Convex dev + web on port 3001):

1. Visit `/profile` as a paid-plan user → opt-in card renders; accept → empty scaffolding (8 faint loci).
2. In `/chat`, send a message in a conversation; confirm in the Convex dashboard that the conversation row gains `pendingExtractionId` and `lastMessageAt`.
3. In the Convex dashboard, run `internal.profile.extractPositions` manually with that conversation's id (don't wait 30 minutes). Confirm `positions` rows appear only if the transcript contains genuine first-person affirmations, and the conversation's `lastExtractedOrder` advanced with `pendingExtractionId` cleared.
4. On `/profile`: edit a statement (apparatus shows "edited"), exclude, delete, export (downloads `your-theology.md`), pause toggle, delete-everything (confirm dialog, page returns to opt-in card).
5. Click a position's "source conversation" link → `/chat?c=…` opens that conversation.
6. Check `/profile` as a free user (or temporarily hard-code `planId = "free"` in `getProfile` and revert) → locked preview.

- [ ] **Step 4: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/chat/chat-sidebar.tsx apps/web/src/components/chat/chat-sidebar.module.css
git commit -m "feat(web): Your Theology nav link in chat sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of Scope (Phases 2–3 — do not build)

Tension detection, `tensions` table, tensions UI, dismissal-rate monitoring, profile summary + prompt injection, followup chips, development-over-time view, Batch API extraction, in-chat opt-in prompt. The spec's manual quality review across ≥50 real conversations gates Phase 2.

## Known Deviations from the Spec Document

- `lastExtractedOrder` (numeric agent-message `order`) instead of `lastExtractedMessageId` — same semantics, simpler delta comparisons.
- No `sourceMessageId` on positions — per-claim message attribution from a transcript pass would be LLM-guessed; the conversation link is the verifiable source. Revisit in Phase 2 if per-message linking is wanted.
