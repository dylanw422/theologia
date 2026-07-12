# Theological Profile Phase 3 ("The Companion") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the theological profile active inside the product: inject a deterministic summary of the user's affirmed positions into the chat system prompt, let the model offer profile-aware followup chips, and show per-topic development-over-time on `/profile`.

**Architecture:** A new pure lib (`convex/lib/profileSummary.ts`) assembles the summary from position rows at reply time — no Haiku call, no cache (see the spec's "Deviation" section). A new `getPromptProfile` internalQuery gates on opt-in; `chat.streamReply` appends its output to the system prompt for paid plans, failure-tolerant. `getProfile` additionally returns full position history; the web profile page renders an expandable per-topic development view from it.

**Tech Stack:** Convex (queries/actions, convex-test), Vitest, Next.js (App Router, CSS modules), Bun monorepo (turbo).

**Spec:** `docs/superpowers/specs/2026-07-12-theological-profile-phase3-design.md`

## Global Constraints

- `PROFILE_SUMMARY_MAX_CHARS = 2400` (~600 tokens) — hard truncation on whole-line boundaries.
- Paused still injects: pause stops extraction, not use of what's recorded.
- Free plan never gets injection; the plan gate lives in `chat.streamReply` (which already resolves `planId`), NOT in `getPromptProfile` — the polar component can't run under convex-test.
- Never use the word "contradiction" (any form) in prompt or UI copy — Phase 2 house rule.
- A profile failure must never block or break a reply.
- Backend tests: files using `convexTest` need `// @vitest-environment edge-runtime` at the top; pure-lib tests are plain vitest. Run from `packages/backend` with `bunx vitest run <path>`.
- Web tests: run from `apps/web` with `bunx vitest run <path>`.
- Commit directly to `master` (repo convention), one commit per task, messages in the existing `feat(backend):` / `feat(web):` / `test(backend):` style.

---

### Task 1: `lib/profileSummary.ts` — deterministic summary + prompt section

**Files:**
- Create: `packages/backend/convex/lib/profileSummary.ts`
- Test: `packages/backend/convex/lib/profileSummary.test.ts`

**Interfaces:**
- Consumes: `latestPerTopic`, `getLocusLabel`, `LocusId`, `Stance`, `Strength` from `packages/backend/convex/lib/profile.ts` (all already exist).
- Produces (Task 2 relies on these exact signatures):
  - `type SummaryPosition = { locus: LocusId; topic: string; statement: string; stance: Stance; strength: Strength; createdAt: number; excluded: boolean }`
  - `buildProfileSummary(positions: SummaryPosition[]): string | null` — null when nothing qualifies
  - `buildProfileSection(summary: string): string` — the full `## The user's theological profile` block
  - `PROFILE_SUMMARY_MAX_CHARS = 2400`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/lib/profileSummary.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  buildProfileSection,
  buildProfileSummary,
  PROFILE_SUMMARY_MAX_CHARS,
  type SummaryPosition,
} from "./profileSummary";

function pos(overrides: Partial<SummaryPosition> = {}): SummaryPosition {
  return {
    locus: "soteriology",
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed",
    strength: "settled",
    createdAt: 1,
    excluded: false,
    ...overrides,
  };
}

describe("buildProfileSummary", () => {
  it("formats one line per position: locus label, topic, statement, stance, strength", () => {
    expect(buildProfileSummary([pos()])).toBe(
      "- [Soteriology / election] Regeneration precedes faith. (affirmed, settled)",
    );
  });

  it("returns null for empty input and for all-excluded input", () => {
    expect(buildProfileSummary([])).toBeNull();
    expect(buildProfileSummary([pos({ excluded: true })])).toBeNull();
  });

  it("collapses to the latest claim per topic and drops excluded ones", () => {
    const summary = buildProfileSummary([
      pos({ statement: "Old reading.", createdAt: 100 }),
      pos({ statement: "New reading.", createdAt: 200 }),
      pos({ topic: "atonement", statement: "Hidden.", excluded: true }),
    ]);
    expect(summary).toContain("New reading.");
    expect(summary).not.toContain("Old reading.");
    expect(summary).not.toContain("Hidden.");
  });

  it("orders settled → leaning → exploring, newest first within a band", () => {
    const summary = buildProfileSummary([
      pos({ topic: "explore-new", strength: "exploring", createdAt: 500 }),
      pos({ topic: "settled-old", strength: "settled", createdAt: 100 }),
      pos({ topic: "settled-new", strength: "settled", createdAt: 200 }),
      pos({ topic: "leaning-mid", strength: "leaning", createdAt: 400 }),
    ]);
    expect(summary).not.toBeNull();
    const order = ["settled-new", "settled-old", "leaning-mid", "explore-new"].map(
      (topic) => summary!.indexOf(topic),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("caps at PROFILE_SUMMARY_MAX_CHARS on whole-line boundaries, strongest surviving", () => {
    // Each line ≈ 1192 chars: two fit under 2400, the third (exploring) falls off.
    const long = "x".repeat(1150);
    const summary = buildProfileSummary([
      pos({ topic: "t-a", statement: long, createdAt: 3 }),
      pos({ topic: "t-b", statement: long, createdAt: 2 }),
      pos({ topic: "t-c", statement: long, strength: "exploring", createdAt: 1 }),
    ]);
    expect(summary).not.toBeNull();
    expect(summary!.length).toBeLessThanOrEqual(PROFILE_SUMMARY_MAX_CHARS);
    expect(summary).toContain("t-a");
    expect(summary).toContain("t-b");
    expect(summary).not.toContain("t-c");
  });
});

describe("buildProfileSection", () => {
  it("wraps the summary with header, usage rules, and the followup guidance", () => {
    const section = buildProfileSection("- [Soteriology / election] X (affirmed, settled)");
    expect(section).toContain("## The user's theological profile");
    expect(section).toContain("- [Soteriology / election] X (affirmed, settled)");
    expect(section).toContain("<followups>");
    expect(section).toContain("Build on these positions");
    // Phase 2 house rule applies to prompt copy too.
    expect(section).not.toMatch(/contradict/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profileSummary.test.ts`
Expected: FAIL — cannot resolve `./profileSummary`.

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/lib/profileSummary.ts`:

```typescript
import {
  getLocusLabel,
  latestPerTopic,
  type LocusId,
  type Stance,
  type Strength,
} from "./profile";

/**
 * Phase 3 prompt injection (docs/THEOLOGICAL_PROFILE.md §4). The summary is
 * assembled deterministically from position rows — statements are already
 * one-sentence, user-voice strings, so concatenation IS the summary. No
 * model call, no cache, no staleness.
 */
export type SummaryPosition = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
  createdAt: number;
  excluded: boolean;
};

/** ~600 tokens. A hard truncation, not a hope (spec's words). */
export const PROFILE_SUMMARY_MAX_CHARS = 2400;

const STRENGTH_ORDER: Record<Strength, number> = {
  settled: 0,
  leaning: 1,
  exploring: 2,
};

/**
 * Latest non-excluded claim per topic, settled → leaning → exploring, newest
 * first within a band. Truncation keeps whole lines and stops at the first
 * overflow, so settled positions survive and exploring ones fall off first.
 * Returns null when nothing qualifies — an empty profile injects nothing.
 */
export function buildProfileSummary(
  positions: SummaryPosition[],
): string | null {
  const latest = latestPerTopic(positions).sort(
    (a, b) =>
      STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
      b.createdAt - a.createdAt,
  );

  const lines: string[] = [];
  let total = 0;
  for (const position of latest) {
    const locus = getLocusLabel(position.locus) ?? position.locus;
    const line = `- [${locus} / ${position.topic}] ${position.statement} (${position.stance}, ${position.strength})`;
    const cost = line.length + (lines.length > 0 ? 1 : 0);
    if (total + cost > PROFILE_SUMMARY_MAX_CHARS) break;
    lines.push(line);
    total += cost;
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * The system-prompt section around the summary. Register per GOAL.md: build
 * on the user's study, never police it. The followup rule here IS the
 * "tension followup chips" feature — the <followups> tag already renders
 * as chips end-to-end.
 */
export function buildProfileSection(summary: string): string {
  return `## The user's theological profile

The user has opted into a theological profile: positions they have affirmed in their own voice across their prior study, recorded one sentence at a time. These are their words, not yours.

${summary}

How to use this:
- Build on these positions instead of re-explaining ground the user has already worked through.
- Never volunteer observations about the profile that the user did not ask for, and never grade or comment on its consistency.
- When your reply bears directly on one of these positions, you may end with a <followups> chip connecting them (for example: How does this square with my view of election?). Only when genuinely apt — the user pulls; you never push.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/lib/profileSummary.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/lib/profileSummary.ts packages/backend/convex/lib/profileSummary.test.ts
git commit -m "feat(backend): deterministic profile summary + prompt section for phase 3 injection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `getPromptProfile` internal query + injection in `streamReply`

**Files:**
- Modify: `packages/backend/convex/profile.ts` (add one internalQuery; imports)
- Modify: `packages/backend/convex/chat.ts:189-205` (system prompt assembly in `streamReply`)
- Test: `packages/backend/convex/profile.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `buildProfileSummary`, `buildProfileSection` from Task 1; existing `settingsForUser` helper.
- Produces: `internal.profile.getPromptProfile` — internalQuery, args `{ userId: v.string() }`, returns `string | null` (the full section, or null when not opted in / nothing visible). Plan gating is the CALLER's job.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/profile.test.ts` (the file already imports `convexTest`, `internal`, `upsertSettings`, `schema`, `modules`):

```typescript
describe("getPromptProfile", () => {
  const position = (conversationId: Id<"conversations">, excluded: boolean) => ({
    userId: "u1",
    locus: "soteriology" as const,
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed" as const,
    strength: "settled" as const,
    sourceConversationId: conversationId,
    excluded,
    userEdited: false,
  });

  test("null before opt-in, and null when nothing is visible", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u1" }),
    ).toBeNull();

    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true });
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      await ctx.db.insert("positions", position(conversationId, true));
    });
    // Opted in, but the only position is excluded.
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u1" }),
    ).toBeNull();
  });

  test("returns the section when opted in — paused still injects", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true, paused: true });
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      await ctx.db.insert("positions", position(conversationId, false));
    });
    const section = await t.query(internal.profile.getPromptProfile, {
      userId: "u1",
    });
    expect(section).toContain("## The user's theological profile");
    expect(section).toContain("Regeneration precedes faith.");
    // Someone else's profile never leaks.
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u2" }),
    ).toBeNull();
  });
});
```

Add `Id` to the imports at the top of the file:

```typescript
import type { Id } from "./_generated/dataModel";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — `getPromptProfile` does not exist on `internal.profile`.

- [ ] **Step 3: Implement `getPromptProfile` in `profile.ts`**

Add to the imports block of `packages/backend/convex/profile.ts`:

```typescript
import { buildProfileSection, buildProfileSummary } from "./lib/profileSummary";
```

Add after the `exportProfile` query (line ~228):

```typescript
/**
 * Phase 3 prompt injection: the profile section appended to the chat system
 * prompt. Plan gating (free tier gets nothing) lives at the call site in
 * chat.streamReply, which has already resolved the plan — the polar
 * component isn't available under convex-test. Gates on opt-in only;
 * paused still injects, because pause stops extraction, not use.
 */
export const getPromptProfile = internalQuery({
  args: { userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const settings = await settingsForUser(ctx, args.userId);
    if (!settings?.optedIn) return null;
    const docs = await ctx.db
      .query("positions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const summary = buildProfileSummary(
      docs.map((d) => ({
        locus: d.locus,
        topic: d.topic,
        statement: d.statement,
        stance: d.stance,
        strength: d.strength,
        createdAt: d._creationTime,
        excluded: d.excluded,
      })),
    );
    return summary === null ? null : buildProfileSection(summary);
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: PASS (all existing tests plus the 2 new ones).

- [ ] **Step 5: Wire injection into `streamReply` in `chat.ts`**

In `packages/backend/convex/chat.ts`, replace lines 189-203 (`const system = ...` through the `streamText` call's opening):

```typescript
    let system = buildSystemPrompt(conversation.mode, conversation);
    try {
      const planId = await getPlanIdForUser(ctx, conversation.userId);
      const model = anthropic(PLANS[planId].model);
      // Profile-aware answers (Phase 3): opted-in paid users get their
      // affirmed positions appended to the system prompt. Never blocks the
      // reply — any failure degrades to an un-augmented answer.
      if (planId !== "free") {
        try {
          const profileSection: string | null = await ctx.runQuery(
            internal.profile.getPromptProfile,
            { userId: conversation.userId },
          );
          if (profileSection) system = `${system}\n\n${profileSection}`;
        } catch (error) {
          console.error("getPromptProfile failed", error);
        }
      }
      const result = await theologiaAgent.streamText(
```

(The rest of the `streamText` call and the outer `catch` are unchanged. The only other edit is `const system` → `let system` and moving it above the injection.)

- [ ] **Step 6: Typecheck and run the full backend suite**

Run: `cd /Users/dylanwest/Coding/theologia && bun run check-types && cd packages/backend && bunx vitest run`
Expected: typecheck clean; all backend tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts packages/backend/convex/chat.ts
git commit -m "feat(backend): profile-aware system prompt — getPromptProfile injected in streamReply

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `getProfile` returns position history

**Files:**
- Modify: `packages/backend/convex/profile.ts:111-138` (`visiblePositions`, `getProfile`)
- Test: `packages/backend/convex/profile.test.ts` (append a describe block)

**Interfaces:**
- Produces: `getProfile` response gains `history` — ALL non-excluded position views (same shape as `positions` entries, i.e. `toPositionView` output), sorted **oldest-first**. The `positions` field (latest-per-topic, newest-first) is unchanged. The free / not-opted-in branch returns `history: []`. Also exports `allVisiblePositions(ctx, userId)` for tests.
- Task 4 relies on: `history` entries carrying `id`, `topic`, `statement`, `stance`, `strength`, `frameworkAtTime`, `sourceConversationId`, `createdAt`, oldest-first ordering.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/profile.test.ts`:

```typescript
describe("allVisiblePositions", () => {
  test("drops excluded rows, keeps full per-topic history", async () => {
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
        topic: "election",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      await ctx.db.insert("positions", { ...base, statement: "first" });
      await ctx.db.insert("positions", { ...base, statement: "second" });
      await ctx.db.insert("positions", {
        ...base,
        statement: "hidden",
        excluded: true,
      });

      const all = await allVisiblePositions(ctx as never, "u1");
      expect(all).toHaveLength(2);
      const history = [...all].sort((a, b) => a.createdAt - b.createdAt);
      expect(history.map((p) => p.statement)).toEqual(["first", "second"]);
    });
  });
});
```

Add `allVisiblePositions` to the `./profile` import at the top of the file:

```typescript
import { allVisiblePositions, deleteTensionsReferencing, scheduleExtraction, settingsForUser, upsertSettings } from "./profile";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — `allVisiblePositions` is not exported.

- [ ] **Step 3: Implement**

In `packages/backend/convex/profile.ts`, replace the existing `visiblePositions` function (lines 111-117) with:

```typescript
export async function allVisiblePositions(ctx: QueryCtx, userId: string) {
  const docs = await ctx.db
    .query("positions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return docs.map(toPositionView).filter((p) => !p.excluded);
}

async function visiblePositions(ctx: QueryCtx, userId: string) {
  return latestPerTopic(await allVisiblePositions(ctx, userId));
}
```

Then update `getProfile` (lines 119-138) to:

```typescript
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
      return { planId, optedIn, paused, positions: [], history: [] };
    }
    const all = await allVisiblePositions(ctx, user._id);
    return {
      planId,
      optedIn,
      paused,
      positions: latestPerTopic(all),
      // Full per-topic history, oldest-first — Phase 3's development view.
      history: [...all].sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});
```

(`latestPerTopic` filters excluded itself, so passing the pre-filtered list is equivalent. `exportProfile` keeps using `visiblePositions` unchanged.)

- [ ] **Step 4: Run tests and typecheck**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts && cd ../.. && bun run check-types`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): getProfile returns oldest-first position history for the development view

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Development-over-time view on `/profile`

**Files:**
- Create: `apps/web/src/components/profile/lib/development.ts`
- Test: `apps/web/src/components/profile/lib/development.test.ts`
- Modify: `apps/web/src/components/profile/profile-page.tsx`
- Modify: `apps/web/src/components/profile/profile-page.module.css`

**Interfaces:**
- Consumes: `getProfile().history` from Task 3 — non-excluded position views, oldest-first, with `id`, `topic`, `statement`, `stance`, `strength`, `frameworkAtTime`, `sourceConversationId`, `createdAt`.
- Produces (component-internal):
  - `topicHistories<T extends { topic: string }>(history: T[]): Map<string, T[]>` — groups preserving input (oldest-first) order
  - `developmentLabel(entries: ReadonlyArray<{ createdAt: number }>): string` — `"3 positions, Mar → Jul"` same-year, `"2 positions, Nov 2025 → Jul 2026"` across years; only called with ≥2 entries

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/profile/lib/development.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { developmentLabel, topicHistories } from "./development";

describe("topicHistories", () => {
  it("groups by topic preserving input order", () => {
    const grouped = topicHistories([
      { topic: "election", createdAt: 1 },
      { topic: "baptism", createdAt: 2 },
      { topic: "election", createdAt: 3 },
    ]);
    expect(grouped.get("election")?.map((e) => e.createdAt)).toEqual([1, 3]);
    expect(grouped.get("baptism")?.map((e) => e.createdAt)).toEqual([2]);
  });

  it("returns an empty map for empty history", () => {
    expect(topicHistories([]).size).toBe(0);
  });
});

describe("developmentLabel", () => {
  it("labels a same-year run with bare months", () => {
    expect(
      developmentLabel([
        { createdAt: Date.UTC(2026, 2, 15) },
        { createdAt: Date.UTC(2026, 4, 15) },
        { createdAt: Date.UTC(2026, 6, 15) },
      ]),
    ).toBe("3 positions, Mar → Jul");
  });

  it("includes years when the run crosses a year boundary", () => {
    expect(
      developmentLabel([
        { createdAt: Date.UTC(2025, 10, 15) },
        { createdAt: Date.UTC(2026, 6, 15) },
      ]),
    ).toBe("2 positions, Nov 2025 → Jul 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/apps/web && bunx vitest run src/components/profile/lib/development.test.ts`
Expected: FAIL — cannot resolve `./development`.

- [ ] **Step 3: Implement the lib**

Create `apps/web/src/components/profile/lib/development.ts`:

```typescript
/**
 * Development-over-time view helpers (Phase 3): the positions table is
 * append-only, so a topic's history is its list of claims oldest-first.
 */

export function topicHistories<T extends { topic: string }>(
  history: T[],
): Map<string, T[]> {
  const byTopic = new Map<string, T[]>();
  for (const entry of history) {
    const list = byTopic.get(entry.topic);
    if (list) list.push(entry);
    else byTopic.set(entry.topic, [entry]);
  }
  return byTopic;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

/** "3 positions, Mar → Jul" — entries must be oldest-first and ≥2 long. */
export function developmentLabel(
  entries: ReadonlyArray<{ createdAt: number }>,
): string {
  const first = new Date(entries[0].createdAt);
  const last = new Date(entries[entries.length - 1].createdAt);
  const format =
    first.getFullYear() === last.getFullYear() ? MONTH : MONTH_YEAR;
  return `${entries.length} positions, ${format.format(first)} → ${format.format(last)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dylanwest/Coding/theologia/apps/web && bunx vitest run src/components/profile/lib/development.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Render the view in `profile-page.tsx`**

In `apps/web/src/components/profile/profile-page.tsx`:

1. Add the import (after the `TensionsSection` import):

```typescript
import { developmentLabel, topicHistories } from "./lib/development";
```

2. Add state next to the existing `editingId` state (line ~36):

```typescript
const [devOpenTopic, setDevOpenTopic] = useState<string | null>(null);
```

3. After the `if (profile === null) return null;` guard, compute the grouping:

```typescript
const histories = topicHistories(profile.history);
```

4. Inside the position card, insert between the closing `</p>` of the apparatus paragraph (line ~193) and the `{editingId !== position.id && (` actions block:

```tsx
                          {(histories.get(position.topic)?.length ?? 0) > 1 && (
                            <div className={styles.development}>
                              <button
                                type="button"
                                className={styles.devToggle}
                                aria-expanded={devOpenTopic === position.topic}
                                onClick={() =>
                                  setDevOpenTopic(
                                    devOpenTopic === position.topic
                                      ? null
                                      : position.topic,
                                  )
                                }
                              >
                                development ·{" "}
                                {developmentLabel(histories.get(position.topic)!)}
                              </button>
                              {devOpenTopic === position.topic && (
                                <ol className={styles.devList}>
                                  {histories
                                    .get(position.topic)!
                                    .slice(0, -1)
                                    .map((entry) => (
                                      <li key={entry.id} className={styles.devItem}>
                                        <p className={styles.devStatement}>
                                          {entry.statement}
                                        </p>
                                        <p className={styles.apparatus}>
                                          {[
                                            entry.stance,
                                            entry.strength,
                                            entry.frameworkAtTime
                                              ? (getFramework(entry.frameworkAtTime)
                                                  ?.label ?? entry.frameworkAtTime)
                                              : null,
                                            formatDate(entry.createdAt),
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                          {" · "}
                                          <Link
                                            href={`/chat?c=${entry.sourceConversationId}`}
                                            className={styles.sourceLink}
                                          >
                                            source conversation
                                          </Link>
                                        </p>
                                      </li>
                                    ))}
                                </ol>
                              )}
                            </div>
                          )}
```

(`.slice(0, -1)` — the latest claim is the card itself; the expansion shows only the earlier readings, oldest first.)

5. Append to `apps/web/src/components/profile/profile-page.module.css`:

```css
.development {
  margin-bottom: 0.45rem;
}

.devToggle {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--stone);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.devToggle:hover {
  color: var(--gold-bright);
}

.devList {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0 0 0 0.9rem;
  border-left: 1px solid var(--hairline);
}

.devItem {
  margin-bottom: 0.9rem;
}
.devItem:last-child {
  margin-bottom: 0;
}

.devStatement {
  font-family: var(--font-fraunces), serif;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--parchment);
  opacity: 0.85;
  margin: 0 0 0.3rem;
}
```

- [ ] **Step 6: Typecheck and run the web suite**

Run: `cd /Users/dylanwest/Coding/theologia && bun run check-types && cd apps/web && bunx vitest run`
Expected: typecheck clean; all web tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/profile
git commit -m "feat(web): development-over-time view per topic on /profile

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Consent copy — describe use, not just storage

**Files:**
- Modify: `apps/web/src/components/profile/profile-page.tsx` (header lede, `OptInCard` copy)

**Interfaces:** none — copy only.

- [ ] **Step 1: Update the lede**

In the header of `profile-page.tsx`, replace the lede paragraph:

```tsx
          <p className={styles.lede}>
            Positions you have affirmed across your conversations, organized by
            the classical loci and sourced back to the study where you took
            them. Your studies read these positions too, so answers build on
            what you have already worked through. Yours to edit, export, or
            erase — never shared, never used in marketing, never used to train
            models.
          </p>
```

- [ ] **Step 2: Update the `OptInCard` copy**

Replace the `optInCopy` paragraph in `OptInCard`:

```tsx
      <p className={styles.optInCopy}>
        With your permission, Theologia will read your finished conversations
        and record the theological positions you affirm in your own words — one
        sentence each, dated, and linked to the conversation where you took
        them. Only what you yourself affirm is recorded; never the
        assistant&apos;s views, never positions you argue against for practice.
        Your recorded positions are also read by your study companion when it
        answers you, so new study builds on ground you have already covered.
        Everything is editable and deletable, you can pause or export at any
        time, and your profile is never shared with anyone, never used in
        marketing, and never used to train models.
      </p>
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dylanwest/Coding/theologia && bun run check-types`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/profile/profile-page.tsx
git commit -m "feat(web): consent copy names prompt injection — the profile informs answers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full-suite verification

**Files:** none new.

- [ ] **Step 1: Run everything**

Run:

```bash
cd /Users/dylanwest/Coding/theologia && bun run check-types
cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run
cd /Users/dylanwest/Coding/theologia/apps/web && bunx vitest run
```

Expected: all clean/green. If anything fails, fix before declaring the phase done — no commit with red tests.

- [ ] **Step 2: Manual smoke (requires `bun run dev`, port 3001)**

- Opted-in paid user with ≥1 position: send a chat message on a topic near a stored position; confirm the reply lands normally (injection must never break replies) and profile-aware chips appear only when apt.
- `/profile`: a topic with ≥2 claims shows the `development · N positions, X → Y` toggle; expansion lists earlier readings oldest-first with source links.
- Free account: chat works, no profile injection (no behavioral change), `/profile` still shows the locked preview.
