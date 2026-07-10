# Theological Profile — Phase 2 (the mirror) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the Theological Profile: Sonnet-judged tension detection over the positions ledger, a tensions UI on `/profile` with Study this / Resolved / Dismiss, a sidebar count badge, and a dismissal-rate quality query.

**Architecture:** When an extraction pass records ≥1 claim, `recordExtraction` schedules `internal.tensions.detectTensions` (runAfter 0). That action gathers the user's latest non-excluded positions in the new claims' loci plus a static adjacency map's neighbors, runs one abstention-biased Sonnet 5 judgment call with a fail-closed parser, and appends tensions (one per position pair, ever) to a `tensions` table. `/profile` renders up to 5 open tensions strongest-first with three actions; the sidebar link shows an open count. Import direction is one-way — `tensions.ts` imports from `profile.ts`, never the reverse (cascade deletes live in `profile.ts` using plain `ctx.db` table access; the extraction→detection hop is a function reference through `internal.*`, not a module import).

**Tech Stack:** Convex (`packages/backend/convex/`), `@ai-sdk/anthropic` + `ai` (`generateText`), vitest + `convex-test` (edge-runtime), Next.js 16 / React 19 with CSS modules, bun workspaces.

Spec: `docs/superpowers/specs/2026-07-09-theological-profile-phase2-design.md` (companion: `docs/THEOLOGICAL_PROFILE.md`).

## Global Constraints

- **Model:** judgment uses exactly `anthropic("claude-sonnet-5")` — same provider pattern as `chat.ts`. No date suffix.
- **Copy rules:** the word "contradiction" (any form) never appears in UI copy, in the prompt's requested output language, or in stored descriptions — the parser drops any item matching `/contradict/i`. No scoring/grading language.
- **Abstention bias (spec, verbatim):** "a false alarm is worse than a miss; if nothing rises to a real tension, return empty."
- **Pair uniqueness:** one tension per position pair, ever — open, resolved, or dismissed all block re-creation. Dismissed pairs never resurface.
- **Caps:** `MAX_TENSIONS_PER_PASS = 3` (parser), `MAX_OPEN_SURFACED = 5` (UI selection, salience desc then newest).
- **Tier gate:** Scholar+ AND `profileSettings.optedIn` AND not `paused`, re-checked inside the action; `getTensions`/`openCount` return empty/0 when gated.
- **Convex rules:** every function has arg validators; internal functions use `internalQuery/internalMutation/internalAction`; **Convex module paths forbid hyphens** (learned in Phase 1 — hence `lib/tensions.ts`, camelCase everywhere).
- **Testing:** backend suite: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test` (do NOT use `bunx vitest` for edge-runtime tests — the bunx cache lacks `@edge-runtime/vm`). Pattern per Phase 1: pure lib helpers unit-tested; ctx-taking helpers via `convex-test` `t.run(ctx => helper(ctx as never, ...))`; internal functions via `t.mutation(internal.…)`/`t.query(internal.…)`; auth-gated public functions stay thin and untested.
- **Codegen:** after creating `convex/tensions.ts`, run `cd packages/backend && bunx convex codegen` and commit the regenerated `convex/_generated/api.d.ts`.
- **Git:** the working tree contains unrelated in-flight changes in `packages/backend/convex/chat.ts` and several `apps/web/src/components/chat/*` files (verse-insert feature). Commit with **explicit file paths only**. `convex/profile.ts`, `convex/profile.test.ts`, `chat-sidebar.tsx`, and all new files are clean — plain `git add` is safe for them. Commit to `master` directly. End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Formatting:** run `bunx prettier --write` on new/modified web files before committing (repo conforms to default Prettier).

---

### Task 1: Pure tension logic — `lib/tensions.ts`

Adjacency map, prompt builders, fail-closed parser, pair keys, top-5 selection, study-prompt builder. Everything downstream imports from here; the web app imports `buildStudyPrompt` cross-package.

**Files:**
- Create: `packages/backend/convex/lib/tensions.ts`
- Test: `packages/backend/convex/lib/tensions.test.ts`

**Interfaces:**
- Consumes: `LOCI`, `LOCUS_IDS`, `type LocusId`, `type Stance` from `./profile`; `getFramework` from `./studyData`
- Produces:
  - `ADJACENT_LOCI: Record<LocusId, readonly LocusId[]>` (symmetric)
  - `lociToConsider(loci: readonly LocusId[]): LocusId[]` (self + adjacents, canonical order, deduped)
  - `pairKey(idA: string, idB: string): string` (order-independent)
  - `type JudgePosition = { statement: string; locus: LocusId; stance: Stance; topic: string }`
  - `type IndexPair = readonly [number, number]`
  - `buildTensionSystemPrompt(): string`
  - `buildTensionUserPrompt(positions: JudgePosition[], coveredIndexPairs: IndexPair[], framework?: string): string`
  - `type ParsedTension = { a: number; b: number; description: string; historicalNote?: string; salience: number }`
  - `parseTensionResponse(raw: string, positionCount: number, coveredIndexPairs: IndexPair[]): ParsedTension[]`
  - `selectOpenTensions<T extends { salience: number; createdAt: number }>(tensions: T[]): T[]`
  - `buildStudyPrompt(statementA: string, statementB: string): string`
  - `MAX_TENSIONS_PER_PASS = 3`, `MAX_OPEN_SURFACED = 5`

- [ ] **Step 1: Write the failing tests**

Create `packages/backend/convex/lib/tensions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { LOCUS_IDS, type LocusId } from "./profile";
import {
  ADJACENT_LOCI,
  buildStudyPrompt,
  buildTensionSystemPrompt,
  buildTensionUserPrompt,
  lociToConsider,
  MAX_OPEN_SURFACED,
  MAX_TENSIONS_PER_PASS,
  pairKey,
  parseTensionResponse,
  selectOpenTensions,
  type JudgePosition,
} from "./tensions";

describe("ADJACENT_LOCI", () => {
  it("covers all eight loci and is symmetric", () => {
    expect(Object.keys(ADJACENT_LOCI).sort()).toEqual([...LOCUS_IDS].sort());
    for (const locus of LOCUS_IDS) {
      for (const neighbor of ADJACENT_LOCI[locus]) {
        expect(ADJACENT_LOCI[neighbor]).toContain(locus);
        expect(neighbor).not.toBe(locus);
      }
    }
  });
});

describe("lociToConsider", () => {
  it("includes the input loci plus adjacents, deduped, in canonical order", () => {
    const out = lociToConsider(["soteriology"]);
    expect(out).toContain("soteriology");
    expect(out).toContain("anthropology-sin");
    expect(out).toContain("theology-proper");
    expect(new Set(out).size).toBe(out.length);
    // Canonical order: theology-proper (index 1) precedes soteriology (index 5).
    expect(out.indexOf("theology-proper")).toBeLessThan(out.indexOf("soteriology"));
  });

  it("returns [] for []", () => {
    expect(lociToConsider([])).toEqual([]);
  });
});

describe("pairKey", () => {
  it("is order-independent and distinguishes pairs", () => {
    expect(pairKey("x1", "x2")).toBe(pairKey("x2", "x1"));
    expect(pairKey("x1", "x2")).not.toBe(pairKey("x1", "x3"));
  });
});

const position = (over: Partial<JudgePosition> = {}): JudgePosition => ({
  statement: "Regeneration precedes faith.",
  locus: "soteriology" as LocusId,
  stance: "affirmed",
  topic: "election",
  ...over,
});

describe("prompts", () => {
  it("system prompt carries abstention bias, the JSON contract, and the banned word rule", () => {
    const system = buildTensionSystemPrompt();
    expect(system).toContain('"tensions"');
    expect(system).toContain("return empty");
    expect(system.toLowerCase()).toContain('never use the word "contradiction"');
    expect(system).toContain("salience");
  });

  it("user prompt numbers positions, resolves the framework label, lists covered pairs", () => {
    const prompt = buildTensionUserPrompt(
      [position(), position({ statement: "Grace is resistible.", topic: "grace" })],
      [[0, 1]],
      "reformed",
    );
    expect(prompt).toContain("[0]");
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("Regeneration precedes faith.");
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("(0, 1)");
  });

  it("omits the covered-pairs block when there are none", () => {
    const prompt = buildTensionUserPrompt([position()], [], undefined);
    expect(prompt).not.toContain("Already reviewed");
    expect(prompt).toContain("not specified");
  });
});

describe("parseTensionResponse", () => {
  const valid = {
    a: 0,
    b: 1,
    description: "One position grounds assurance in decree, the other in perseverance.",
    historicalNote: "The Synod of Dort held both by distinguishing ground from evidence.",
    salience: 2,
  };
  const wrap = (tensions: unknown[]) => JSON.stringify({ tensions });

  it("parses a valid payload", () => {
    expect(parseTensionResponse(wrap([valid]), 2, [])).toEqual([valid]);
  });

  it("tolerates a markdown code fence", () => {
    const raw = "```json\n" + wrap([valid]) + "\n```";
    expect(parseTensionResponse(raw, 2, [])).toEqual([valid]);
  });

  it("returns [] on malformed JSON or wrong shape", () => {
    expect(parseTensionResponse("not json", 2, [])).toEqual([]);
    expect(parseTensionResponse('{"tensions": "nope"}', 2, [])).toEqual([]);
    expect(parseTensionResponse('{"other": []}', 2, [])).toEqual([]);
  });

  it("drops invalid items but keeps valid ones", () => {
    const out = parseTensionResponse(
      wrap([
        valid,
        { ...valid, a: 5 }, // out of range
        { ...valid, b: 0 }, // self-pair
        { ...valid, a: "0" }, // non-number index
        { ...valid, salience: 4 }, // out of bounds
        { ...valid, salience: 1.5 }, // non-integer
        { ...valid, description: "" },
        { ...valid, description: "x".repeat(700) },
        "not an object",
      ]),
      6,
      [],
    );
    expect(out).toEqual([valid]);
  });

  it("drops items whose text uses any form of the banned word", () => {
    const out = parseTensionResponse(
      wrap([
        { ...valid, description: "These two claims contradict each other." },
        { ...valid, historicalNote: "A classic contradiction in the tradition." },
      ]),
      2,
      [],
    );
    expect(out).toEqual([]);
  });

  it("normalizes a > b, skips covered pairs and in-payload duplicates", () => {
    const out = parseTensionResponse(
      wrap([
        { ...valid, a: 1, b: 0 }, // normalized to (0,1)
        { ...valid, a: 0, b: 1 }, // duplicate of the first
        { ...valid, a: 2, b: 3 }, // covered
      ]),
      4,
      [[2, 3]],
    );
    expect(out).toEqual([valid]);
  });

  it("treats a missing historicalNote and an empty one the same", () => {
    const out = parseTensionResponse(
      wrap([{ ...valid, historicalNote: "  " }]),
      2,
      [],
    );
    expect(out).toEqual([{ ...valid, historicalNote: undefined }]);
  });

  it("caps items per pass", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...valid,
      a: 0,
      b: i + 1,
    }));
    const out = parseTensionResponse(wrap(many), 11, []);
    expect(out).toHaveLength(MAX_TENSIONS_PER_PASS);
  });
});

describe("selectOpenTensions", () => {
  it("sorts by salience desc then newest, and caps at MAX_OPEN_SURFACED", () => {
    const items = [
      { salience: 1, createdAt: 500 },
      { salience: 3, createdAt: 100 },
      { salience: 2, createdAt: 300 },
      { salience: 2, createdAt: 400 },
      { salience: 1, createdAt: 900 },
      { salience: 1, createdAt: 700 },
      { salience: 1, createdAt: 800 },
    ];
    const out = selectOpenTensions(items);
    expect(out).toHaveLength(MAX_OPEN_SURFACED);
    expect(out[0]).toEqual({ salience: 3, createdAt: 100 });
    expect(out[1]).toEqual({ salience: 2, createdAt: 400 });
    expect(out[2]).toEqual({ salience: 2, createdAt: 300 });
    expect(out[3]).toEqual({ salience: 1, createdAt: 900 });
  });
});

describe("buildStudyPrompt", () => {
  it("quotes both statements and stays in the neutral register", () => {
    const prompt = buildStudyPrompt(
      "Regeneration precedes faith.",
      "Grace is resistible.",
    );
    expect(prompt).toContain("Regeneration precedes faith.");
    expect(prompt).toContain("Grace is resistible.");
    expect(prompt.toLowerCase()).not.toContain("contradict");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test convex/lib/tensions.test.ts`
Expected: FAIL — `Cannot find module './tensions'`.

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/lib/tensions.ts`:

```typescript
import { LOCI, type LocusId, type Stance } from "./profile";
import { getFramework } from "./studyData";

/**
 * Static adjacency over the eight loci (docs/THEOLOGICAL_PROFILE.md §3):
 * tension judgment considers positions in the new claims' loci plus these
 * neighbors. Symmetric by construction — tests assert it.
 */
export const ADJACENT_LOCI: Record<LocusId, readonly LocusId[]> = {
  "scripture-revelation": ["theology-proper"],
  "theology-proper": [
    "scripture-revelation",
    "christology",
    "pneumatology",
    "soteriology",
  ],
  christology: ["theology-proper", "pneumatology", "soteriology", "eschatology"],
  pneumatology: [
    "theology-proper",
    "christology",
    "soteriology",
    "ecclesiology-sacraments",
  ],
  "anthropology-sin": ["soteriology"],
  soteriology: [
    "theology-proper",
    "christology",
    "pneumatology",
    "anthropology-sin",
    "ecclesiology-sacraments",
  ],
  "ecclesiology-sacraments": ["pneumatology", "soteriology", "eschatology"],
  eschatology: ["christology", "ecclesiology-sacraments"],
};

/** The input loci plus their adjacents, deduped, in canonical LOCI order. */
export function lociToConsider(loci: readonly LocusId[]): LocusId[] {
  if (loci.length === 0) return [];
  const wanted = new Set<LocusId>();
  for (const locus of loci) {
    wanted.add(locus);
    for (const neighbor of ADJACENT_LOCI[locus]) wanted.add(neighbor);
  }
  return LOCI.map((l) => l.id).filter((id) => wanted.has(id));
}

/** Order-independent key for a position pair. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

export type JudgePosition = {
  statement: string;
  locus: LocusId;
  stance: Stance;
  topic: string;
};

export type IndexPair = readonly [number, number];

export type ParsedTension = {
  a: number;
  b: number;
  description: string;
  historicalNote?: string;
  salience: number;
};

export const MAX_TENSIONS_PER_PASS = 3;
export const MAX_OPEN_SURFACED = 5;
const MAX_TEXT_CHARS = 600;

/** Any form of the banned word disqualifies an item outright. */
const BANNED = /contradict/i;

export function buildTensionSystemPrompt(): string {
  return `You review theological positions a user has personally affirmed across their study, looking for pairs that stand in real theological tension: places where two affirmations sit uneasily together, where one carries implications that press on the other, or where holding both requires work the user may not have done yet.

You are a careful study partner pointing at the text — never a judge scoring the user. Never use the word "contradiction" or any form of it; describe *what* sits uneasily, not who is right. Never imply that a tradition-approved answer exists.

BIAS TO ABSTAIN. Most position sets contain no real tension. A false alarm is worse than a miss. If nothing rises to a genuine theological tension, return empty.

For each genuine tension, produce:
- "a", "b": the bracketed index numbers of the two positions in tension
- "description": one or two neutral sentences on what sits uneasily between them
- "historicalNote": optional — how the user's own tradition has resolved or lived with this tension, only if you are confident of the history
- "salience": 1 (subtle) | 2 (substantive) | 3 (central to the user's stated commitments)

Respond with STRICT JSON only, no prose, no markdown fence:
{"tensions": [{"a": 0, "b": 2, "description": "...", "historicalNote": "...", "salience": 2}]}

If nothing qualifies, respond exactly: {"tensions": []}`;
}

export function buildTensionUserPrompt(
  positions: JudgePosition[],
  coveredIndexPairs: IndexPair[],
  framework?: string,
): string {
  const frameworkLabel = framework
    ? (getFramework(framework)?.label ?? framework)
    : "not specified";
  const lines = positions.map(
    (p, i) =>
      `[${i}] (${p.locus} / ${p.topic}, ${p.stance}) ${p.statement}`,
  );
  const covered =
    coveredIndexPairs.length > 0
      ? `\n\nAlready reviewed — do NOT report these pairs again: ${coveredIndexPairs
          .map(([a, b]) => `(${a}, ${b})`)
          .join(", ")}`
      : "";
  return `The user studies within this tradition: ${frameworkLabel}.

Positions the user has affirmed:
${lines.join("\n")}${covered}`;
}

function normalizeNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEXT_CHARS) return undefined;
  return trimmed;
}

/**
 * Fail-closed parser for the judgment response, in the same spirit as
 * lib/extraction.ts: malformed payloads yield []; malformed items are
 * dropped; a false tension is worse than a missed one.
 */
export function parseTensionResponse(
  raw: string,
  positionCount: number,
  coveredIndexPairs: IndexPair[],
): ParsedTension[] {
  let text = raw.trim();
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
  const tensions = (parsed as { tensions?: unknown }).tensions;
  if (!Array.isArray(tensions)) return [];

  const seen = new Set(coveredIndexPairs.map(([a, b]) => pairKey(String(a), String(b))));
  const out: ParsedTension[] = [];
  for (const candidate of tensions) {
    if (out.length >= MAX_TENSIONS_PER_PASS) break;
    if (typeof candidate !== "object" || candidate === null) continue;
    const { a, b, description, historicalNote, salience } = candidate as Record<
      string,
      unknown
    >;
    if (typeof a !== "number" || !Number.isInteger(a)) continue;
    if (typeof b !== "number" || !Number.isInteger(b)) continue;
    if (a === b) continue;
    if (a < 0 || b < 0 || a >= positionCount || b >= positionCount) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = pairKey(String(lo), String(hi));
    if (seen.has(key)) continue;
    if (typeof salience !== "number" || !Number.isInteger(salience)) continue;
    if (salience < 1 || salience > 3) continue;
    if (typeof description !== "string") continue;
    const trimmedDescription = description.trim();
    if (!trimmedDescription || trimmedDescription.length > MAX_TEXT_CHARS) continue;
    const note = normalizeNote(historicalNote);
    if (BANNED.test(trimmedDescription) || (note && BANNED.test(note))) continue;
    seen.add(key);
    out.push({
      a: lo,
      b: hi,
      description: trimmedDescription,
      historicalNote: note,
      salience,
    });
  }
  return out;
}

/**
 * The profile surfaces at most MAX_OPEN_SURFACED open tensions, strongest
 * first (docs/THEOLOGICAL_PROFILE.md §Risks, tension fatigue).
 */
export function selectOpenTensions<
  T extends { salience: number; createdAt: number },
>(tensions: T[]): T[] {
  return [...tensions]
    .sort((x, y) => y.salience - x.salience || y.createdAt - x.createdAt)
    .slice(0, MAX_OPEN_SURFACED);
}

/** The seeded first message for the Study this action. Neutral register. */
export function buildStudyPrompt(statementA: string, statementB: string): string {
  return `In my study I've affirmed two positions that may sit uneasily together:

1. "${statementA}"
2. "${statementB}"

Help me study how these relate. Where does the pressure between them lie, what is at stake in holding both, and how has the church wrestled with this?`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test convex/lib/tensions.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/lib/tensions.ts packages/backend/convex/lib/tensions.test.ts
git commit -m "feat(backend): tension adjacency map, judgment prompts, fail-closed parser, study prompt

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Schema — `tensions` table

**Files:**
- Modify: `packages/backend/convex/schema.ts`
- Test: `packages/backend/convex/tensions.test.ts` (create — grows in Tasks 3–4)

**Interfaces:**
- Consumes: nothing new (`v` from `convex/values`)
- Produces: table `tensions` with indexes `by_user`, `by_user_status`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/tensions.test.ts`:

```typescript
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedPositions(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("conversations", {
      userId: "u1",
      threadId: "t1",
      mode: "qa",
      title: "Study",
      framework: "reformed",
    });
    const base = {
      userId: "u1",
      stance: "affirmed" as const,
      strength: "settled" as const,
      sourceConversationId: conversationId,
      frameworkAtTime: "reformed",
      excluded: false,
      userEdited: false,
    };
    const positionAId = await ctx.db.insert("positions", {
      ...base,
      locus: "soteriology",
      topic: "election",
      statement: "Regeneration precedes faith.",
    });
    const positionBId = await ctx.db.insert("positions", {
      ...base,
      locus: "soteriology",
      topic: "grace",
      statement: "Grace is resistible.",
    });
    return { conversationId, positionAId, positionBId };
  });
}

describe("tensions schema", () => {
  test("rows insert and read back by status index", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "Assurance grounded two different ways.",
        historicalNote: "Dort distinguished ground from evidence.",
        salience: 2,
        status: "open",
      });

      const open = await ctx.db
        .query("tensions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", "u1").eq("status", "open"),
        )
        .collect();
      expect(open).toHaveLength(1);
      expect(open[0].salience).toBe(2);
      expect(open[0].resolution).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test convex/tensions.test.ts`
Expected: FAIL — unknown table `tensions`.

- [ ] **Step 3: Extend the schema**

In `packages/backend/convex/schema.ts`, append after the `profileSettings` table (inside `defineSchema({...})`):

```typescript
  // Theological Profile Phase 2 — detected tensions between affirmed
  // positions. One tension per position pair, ever: dismissed and resolved
  // pairs never resurface. docs/THEOLOGICAL_PROFILE.md §Tensions.
  tensions: defineTable({
    userId: v.string(),
    positionAId: v.id("positions"),
    positionBId: v.id("positions"),
    description: v.string(), // neutral, 1–2 sentences; what sits uneasily
    historicalNote: v.optional(v.string()), // how the tradition has handled it
    salience: v.number(), // 1–3, judge-assigned; drives "strongest first"
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolution: v.optional(v.string()), // user's own words, when resolved
    decidedAt: v.optional(v.number()), // ms epoch of resolve/dismiss
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test`
Expected: PASS — new schema test plus all pre-existing suites.

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/schema.ts packages/backend/convex/tensions.test.ts
git commit -m "feat(backend): tensions table with pair provenance, salience, status

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Judgment pipeline — `convex/tensions.ts` internals + scheduling from extraction

**Files:**
- Create: `packages/backend/convex/tensions.ts`
- Modify: `packages/backend/convex/profile.ts` (schedule detection from `recordExtraction`)
- Modify (extend): `packages/backend/convex/tensions.test.ts`, `packages/backend/convex/profile.test.ts`
- Regenerate: `packages/backend/convex/_generated/api.d.ts` (codegen — new module)

**Interfaces:**
- Consumes: `settingsForUser` from `./profile`; `getPlanIdForUser` from `./polar`; `latestPerTopic`, `vLocus` from `./lib/profile`; Task 1's lib exports; `generateText` + `anthropic`
- Produces:
  - `internal.tensions.detectTensions` internalAction `{ userId: string, claimLoci: LocusId[], framework?: string }`
  - `internal.tensions.getJudgmentContext` internalQuery `{ userId, claimLoci }` → `{ eligible: boolean, positions: Array<{ id: Id<"positions">, statement, locus, stance, topic }>, coveredPairKeys: string[] }`
  - `internal.tensions.recordTensions` internalMutation `{ userId, tensions: Array<{ positionAId, positionBId, description, historicalNote?, salience }> }`
  - `recordExtraction` (existing, in `profile.ts`) now schedules `detectTensions` when `claims.length > 0`

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/tensions.test.ts` (add the two imports below to the existing import block at the top of the file):

```typescript
import { internal } from "./_generated/api";
import { upsertSettings } from "./profile";
```

```typescript
describe("getJudgmentContext", () => {
  test("gates on settings; returns latest non-excluded positions in adjacent loci + covered pairs", async () => {
    const t = convexTest(schema, modules);
    const { conversationId, positionAId, positionBId } = await seedPositions(t);

    // Not opted in yet → ineligible.
    let context = await t.query(internal.tensions.getJudgmentContext, {
      userId: "u1",
      claimLoci: ["soteriology"],
    });
    expect(context.eligible).toBe(false);
    expect(context.positions).toEqual([]);

    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true });
      const base = {
        userId: "u1",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      // Adjacent locus (anthropology-sin borders soteriology) — included.
      await ctx.db.insert("positions", {
        ...base,
        locus: "anthropology-sin",
        topic: "total-depravity",
        statement: "The fall corrupts every human faculty.",
      });
      // Non-adjacent locus — excluded from consideration.
      await ctx.db.insert("positions", {
        ...base,
        locus: "scripture-revelation",
        topic: "inerrancy",
        statement: "Scripture is without error.",
      });
      // Excluded position — hidden.
      await ctx.db.insert("positions", {
        ...base,
        locus: "soteriology",
        topic: "assurance",
        statement: "Assurance is of the essence of faith.",
        excluded: true,
      });
      // Existing tension → covered pair.
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 1,
        status: "dismissed",
      });
    });

    context = await t.query(internal.tensions.getJudgmentContext, {
      userId: "u1",
      claimLoci: ["soteriology"],
    });
    expect(context.eligible).toBe(true);
    const topics = context.positions.map((p) => p.topic).sort();
    expect(topics).toEqual(["election", "grace", "total-depravity"]);
    expect(context.coveredPairKeys).toHaveLength(1);
  });
});

describe("recordTensions", () => {
  test("inserts open tensions once per pair, skipping covered and foreign pairs", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);
    const claim = {
      positionAId,
      positionBId,
      description: "Assurance grounded two different ways.",
      salience: 2,
    };

    await t.mutation(internal.tensions.recordTensions, {
      userId: "u1",
      tensions: [claim],
    });
    // Same pair again (either order) → no duplicate.
    await t.mutation(internal.tensions.recordTensions, {
      userId: "u1",
      tensions: [
        { ...claim, positionAId: positionBId, positionBId: positionAId },
      ],
    });
    // Another user's ids → skipped (positions belong to u1).
    await t.mutation(internal.tensions.recordTensions, {
      userId: "u2",
      tensions: [claim],
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("tensions").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: "u1", status: "open", salience: 2 });
    });
  });
});
```

Append to `packages/backend/convex/profile.test.ts`:

```typescript
describe("recordExtraction → tension detection", () => {
  test("schedules detectTensions when claims land, not on empty passes", async () => {
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
      lastExtractedOrder: 2,
      claims: [],
    });
    await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      expect(jobs.filter((j) => j.name.includes("detectTensions"))).toHaveLength(0);
    });

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
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      const detection = jobs.filter((j) => j.name.includes("detectTensions"));
      expect(detection).toHaveLength(1);
      expect(detection[0].args[0]).toMatchObject({
        userId: "u1",
        claimLoci: ["soteriology"],
        framework: "reformed",
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test convex/tensions.test.ts convex/profile.test.ts`
Expected: FAIL — `internal.tensions` doesn't exist / no detection job scheduled.

- [ ] **Step 3: Create `convex/tensions.ts` (pipeline half)**

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { latestPerTopic, vLocus } from "./lib/profile";
import {
  buildTensionSystemPrompt,
  buildTensionUserPrompt,
  lociToConsider,
  pairKey,
  parseTensionResponse,
  type IndexPair,
} from "./lib/tensions";
import { getPlanIdForUser } from "./polar";
import { settingsForUser } from "./profile";

export const getJudgmentContext = internalQuery({
  args: { userId: v.string(), claimLoci: v.array(vLocus) },
  handler: async (ctx, args) => {
    const settings = await settingsForUser(ctx, args.userId);
    const eligible = (settings?.optedIn ?? false) && !(settings?.paused ?? false);
    if (!eligible) {
      return { eligible: false, positions: [], coveredPairKeys: [] };
    }

    const loci = lociToConsider(args.claimLoci);
    const docs = [];
    for (const locus of loci) {
      const inLocus = await ctx.db
        .query("positions")
        .withIndex("by_user_locus", (q) =>
          q.eq("userId", args.userId).eq("locus", locus),
        )
        .collect();
      docs.push(...inLocus);
    }
    const latest = latestPerTopic(
      docs.map((d) => ({ ...d, createdAt: d._creationTime })),
    );
    const positions = latest.map((d) => ({
      id: d._id,
      statement: d.statement,
      locus: d.locus,
      stance: d.stance,
      topic: d.topic,
    }));

    const existing = await ctx.db
      .query("tensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const coveredPairKeys = existing.map((t) =>
      pairKey(t.positionAId, t.positionBId),
    );

    return { eligible: true, positions, coveredPairKeys };
  },
});

const vTensionClaim = v.object({
  positionAId: v.id("positions"),
  positionBId: v.id("positions"),
  description: v.string(),
  historicalNote: v.optional(v.string()),
  salience: v.number(),
});

export const recordTensions = internalMutation({
  args: { userId: v.string(), tensions: v.array(vTensionClaim) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const covered = new Set(
      existing.map((t) => pairKey(t.positionAId, t.positionBId)),
    );
    for (const tension of args.tensions) {
      if (tension.positionAId === tension.positionBId) continue;
      const key = pairKey(tension.positionAId, tension.positionBId);
      if (covered.has(key)) continue;
      const [a, b] = await Promise.all([
        ctx.db.get(tension.positionAId),
        ctx.db.get(tension.positionBId),
      ]);
      if (!a || !b || a.userId !== args.userId || b.userId !== args.userId) {
        continue;
      }
      await ctx.db.insert("tensions", {
        userId: args.userId,
        positionAId: tension.positionAId,
        positionBId: tension.positionBId,
        description: tension.description,
        historicalNote: tension.historicalNote,
        salience: tension.salience,
        status: "open",
      });
      covered.add(key);
    }
  },
});

/**
 * The judgment pass (docs/THEOLOGICAL_PROFILE.md §3). One Sonnet call over
 * the user's positions in the affected + adjacent loci; any failure detects
 * nothing (fail closed) — there is no bookkeeping to unwind.
 */
export const detectTensions = internalAction({
  args: {
    userId: v.string(),
    claimLoci: v.array(vLocus),
    framework: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.tensions.getJudgmentContext, {
        userId: args.userId,
        claimLoci: args.claimLoci,
      });
      if (!context.eligible || context.positions.length < 2) return;

      const planId = await getPlanIdForUser(ctx, args.userId);
      if (planId === "free") return;

      const idToIndex = new Map(context.positions.map((p, i) => [p.id, i]));
      const coveredIndexPairs: IndexPair[] = [];
      for (const key of context.coveredPairKeys) {
        const [idA, idB] = key.split("|") as [Id<"positions">, Id<"positions">];
        const a = idToIndex.get(idA);
        const b = idToIndex.get(idB);
        if (a !== undefined && b !== undefined) {
          coveredIndexPairs.push(a < b ? [a, b] : [b, a]);
        }
      }

      const result = await generateText({
        model: anthropic("claude-sonnet-5"),
        system: buildTensionSystemPrompt(),
        prompt: buildTensionUserPrompt(
          context.positions,
          coveredIndexPairs,
          args.framework,
        ),
        maxOutputTokens: 1500,
      });
      const parsed = parseTensionResponse(
        result.text,
        context.positions.length,
        coveredIndexPairs,
      );
      if (parsed.length === 0) return;

      await ctx.runMutation(internal.tensions.recordTensions, {
        userId: args.userId,
        tensions: parsed.map((item) => ({
          positionAId: context.positions[item.a].id,
          positionBId: context.positions[item.b].id,
          description: item.description,
          historicalNote: item.historicalNote,
          salience: item.salience,
        })),
      });
    } catch (error) {
      console.error("detectTensions failed", error);
    }
  },
});
```

- [ ] **Step 4: Schedule detection from `recordExtraction`**

In `packages/backend/convex/profile.ts`, inside the `recordExtraction` handler, after the existing `ctx.db.patch(args.conversationId, {...})` call, add:

```typescript
    if (args.claims.length > 0) {
      await ctx.scheduler.runAfter(0, internal.tensions.detectTensions, {
        userId: args.userId,
        claimLoci: [...new Set(args.claims.map((claim) => claim.locus))],
        framework: conversation.framework,
      });
    }
```

(`internal` is already imported in `profile.ts`; the reference crosses modules through `_generated/api`, so no module import of `tensions.ts` is added — the import direction stays tensions → profile only.)

- [ ] **Step 5: Codegen, then run the full backend suite**

```bash
cd /Users/dylanwest/Coding/theologia/packages/backend
bunx convex codegen
bun run test
```

Expected: codegen succeeds (new `tensions` module registered); all suites PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/tensions.ts packages/backend/convex/tensions.test.ts packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(backend): Sonnet tension judgment pipeline, scheduled from extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Public tensions API, cascade deletes, quality stats

**Files:**
- Modify: `packages/backend/convex/tensions.ts` (public queries/mutations + `decideTension` helper)
- Modify: `packages/backend/convex/profile.ts` (cascade deletes in `deletePosition`, `deleteAllProfileData`)
- Modify (extend): `packages/backend/convex/tensions.test.ts`, `packages/backend/convex/profile.test.ts`

**Interfaces:**
- Consumes: Task 3's module; `selectOpenTensions` from `./lib/tensions`; `authComponent` from `./auth`
- Produces:
  - `api.tensions.getTensions` — `{}` → `null | { open: TensionView[], resolved: TensionView[] }` where `TensionView = { id, description, historicalNote?, salience, status, resolution?, decidedAt?, createdAt, studyFramework?, positionA: { id, statement, sourceConversationId }, positionB: same }`; open capped at 5 strongest-first; empty arrays when free/not opted in
  - `api.tensions.openCount` — `{}` → `number` (uncapped visible-open count; 0 when gated)
  - `api.tensions.resolveTension` — `{ tensionId, resolution }`
  - `api.tensions.dismissTension` — `{ tensionId }`
  - `internal.tensions.qualityStats` — `{}` → `{ open, resolved, dismissed, dismissalRate: number | null }`
  - Helpers (exported for tests / cross-module use): `decideTension(ctx, userId, tensionId, decision)`, `visibleTensionsForUser(ctx, userId)`
  - In `profile.ts`: `deleteTensionsReferencing(ctx, userId, positionId)` (exported helper)

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/tensions.test.ts` (add to the import block: `import { decideTension, visibleTensionsForUser } from "./tensions";`):

```typescript
describe("decideTension", () => {
  test("resolves with text, dismisses without, rejects re-deciding and foreign users", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);
    const tensionId = await t.run(async (ctx) =>
      ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 2,
        status: "open",
      }),
    );

    await t.run(async (ctx) => {
      await expect(
        decideTension(ctx as never, "intruder", tensionId, {
          status: "dismissed",
        }),
      ).rejects.toThrow("Tension not found");

      await expect(
        decideTension(ctx as never, "u1", tensionId, {
          status: "resolved",
          resolution: "   ",
        }),
      ).rejects.toThrow("Resolution is empty");

      await decideTension(ctx as never, "u1", tensionId, {
        status: "resolved",
        resolution: "Dort distinguishes ground from evidence; I hold both.",
      });
      const row = await ctx.db.get(tensionId);
      expect(row?.status).toBe("resolved");
      expect(row?.resolution).toContain("Dort");
      expect(row?.decidedAt).toBeTypeOf("number");

      await expect(
        decideTension(ctx as never, "u1", tensionId, { status: "dismissed" }),
      ).rejects.toThrow("already decided");
    });
  });
});

describe("visibleTensionsForUser", () => {
  test("hides dismissed tensions and tensions with excluded or deleted positions; resolves studyFramework", async () => {
    const t = convexTest(schema, modules);
    const { conversationId, positionAId, positionBId } = await seedPositions(t);

    await t.run(async (ctx) => {
      const base = {
        userId: "u1",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      const positionCId = await ctx.db.insert("positions", {
        ...base,
        locus: "soteriology",
        topic: "assurance",
        statement: "Assurance is of the essence of faith.",
        excluded: true, // hides any tension touching it
      });
      const positionDId = await ctx.db.insert("positions", {
        ...base,
        locus: "eschatology",
        topic: "millennium",
        statement: "The millennium is the present reign of Christ.",
        // no frameworkAtTime → studyFramework falls back to the conversation's
      });

      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "visible open",
        salience: 3,
        status: "open",
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId: positionCId,
        description: "hidden — excluded position",
        salience: 2,
        status: "open",
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId: positionBId,
        positionBId: positionDId,
        description: "resolved one",
        salience: 1,
        status: "resolved",
        resolution: "Held together in hope.",
        decidedAt: Date.now(),
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId: positionDId,
        description: "dismissed — never renders",
        salience: 3,
        status: "dismissed",
        decidedAt: Date.now(),
      });

      const { open, resolved } = await visibleTensionsForUser(
        ctx as never,
        "u1",
      );
      expect(open).toHaveLength(1);
      expect(open[0].description).toBe("visible open");
      expect(open[0].positionA.statement).toBe("Regeneration precedes faith.");
      expect(open[0].studyFramework).toBe("reformed");
      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolution).toBe("Held together in hope.");
    });
  });
});

describe("qualityStats", () => {
  test("counts by status and computes the dismissal rate over decided tensions", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);

    let stats = await t.query(internal.tensions.qualityStats, {});
    expect(stats).toEqual({
      open: 0,
      resolved: 0,
      dismissed: 0,
      dismissalRate: null,
    });

    await t.run(async (ctx) => {
      const base = {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 1,
      };
      await ctx.db.insert("tensions", { ...base, status: "open" });
      await ctx.db.insert("tensions", { ...base, status: "resolved" });
      await ctx.db.insert("tensions", { ...base, status: "resolved" });
      await ctx.db.insert("tensions", { ...base, status: "dismissed" });
    });

    stats = await t.query(internal.tensions.qualityStats, {});
    expect(stats.open).toBe(1);
    expect(stats.resolved).toBe(2);
    expect(stats.dismissed).toBe(1);
    expect(stats.dismissalRate).toBeCloseTo(1 / 3);
  });
});
```

Append to `packages/backend/convex/profile.test.ts` (add to the import block: `import { deleteTensionsReferencing } from "./profile";`):

```typescript
describe("deleteTensionsReferencing", () => {
  test("removes every tension touching the position, leaves the rest", async () => {
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
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      const pA = await ctx.db.insert("positions", { ...base, topic: "a", statement: "a" });
      const pB = await ctx.db.insert("positions", { ...base, topic: "b", statement: "b" });
      const pC = await ctx.db.insert("positions", { ...base, topic: "c", statement: "c" });
      const tension = { userId: "u1", description: "d", salience: 1, status: "open" as const };
      await ctx.db.insert("tensions", { ...tension, positionAId: pA, positionBId: pB });
      await ctx.db.insert("tensions", { ...tension, positionAId: pB, positionBId: pC });
      await ctx.db.insert("tensions", { ...tension, positionAId: pA, positionBId: pC });

      await deleteTensionsReferencing(ctx as never, "u1", pA);

      const remaining = await ctx.db.query("tensions").collect();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].positionAId).toBe(pB);
      expect(remaining[0].positionBId).toBe(pC);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test convex/tensions.test.ts convex/profile.test.ts`
Expected: FAIL — named exports `decideTension`, `visibleTensionsForUser`, `deleteTensionsReferencing`, `internal.tensions.qualityStats` missing.

- [ ] **Step 3: Add the public half of `convex/tensions.ts`**

Extend the import block at the top of `packages/backend/convex/tensions.ts`:

```typescript
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { selectOpenTensions } from "./lib/tensions";
```

(Merge with the existing imports — `internalAction`/`internalMutation`/`internalQuery`, `Id`, etc. stay.)

Append to the file:

```typescript
async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

type PositionView = {
  id: Id<"positions">;
  statement: string;
  sourceConversationId: Id<"conversations">;
};

function toPositionView(doc: Doc<"positions">): PositionView {
  return {
    id: doc._id,
    statement: doc.statement,
    sourceConversationId: doc.sourceConversationId,
  };
}

async function fallbackFramework(
  ctx: QueryCtx,
  userId: string,
): Promise<string | undefined> {
  const recent = await ctx.db
    .query("conversations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  return recent.find((c) => c.framework)?.framework;
}

/**
 * Tensions the profile may render: dismissed never; any tension whose
 * position is deleted or excluded is hidden (symmetry with the position
 * soft-exclude). Open is capped strongest-first; resolved is newest-first.
 */
export async function visibleTensionsForUser(ctx: QueryCtx, userId: string) {
  const docs = await ctx.db
    .query("tensions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  let fallback: string | undefined | null = null; // null = not yet computed
  const open = [];
  const resolved = [];
  for (const tension of docs) {
    if (tension.status === "dismissed") continue;
    const [a, b] = await Promise.all([
      ctx.db.get(tension.positionAId),
      ctx.db.get(tension.positionBId),
    ]);
    if (!a || !b || a.excluded || b.excluded) continue;

    const newerFirst = a._creationTime >= b._creationTime ? [a, b] : [b, a];
    let studyFramework =
      newerFirst[0].frameworkAtTime ?? newerFirst[1].frameworkAtTime;
    if (!studyFramework) {
      if (fallback === null) fallback = await fallbackFramework(ctx, userId);
      studyFramework = fallback;
    }

    const view = {
      id: tension._id,
      description: tension.description,
      historicalNote: tension.historicalNote,
      salience: tension.salience,
      status: tension.status,
      resolution: tension.resolution,
      decidedAt: tension.decidedAt,
      createdAt: tension._creationTime,
      studyFramework,
      positionA: toPositionView(a),
      positionB: toPositionView(b),
    };
    if (tension.status === "open") open.push(view);
    else resolved.push(view);
  }
  return {
    open: selectOpenTensions(open),
    resolved: resolved.sort((x, y) => (y.decidedAt ?? 0) - (x.decidedAt ?? 0)),
  };
}

async function isGated(ctx: QueryCtx, userId: string): Promise<boolean> {
  const planId = await getPlanIdForUser(ctx, userId);
  if (planId === "free") return true;
  const settings = await settingsForUser(ctx, userId);
  return !settings?.optedIn;
}

export const getTensions = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    if (await isGated(ctx, user._id)) return { open: [], resolved: [] };
    return await visibleTensionsForUser(ctx, user._id);
  },
});

export const openCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return 0;
    if (await isGated(ctx, user._id)) return 0;
    const docs = await ctx.db
      .query("tensions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "open"),
      )
      .collect();
    let count = 0;
    for (const tension of docs) {
      const [a, b] = await Promise.all([
        ctx.db.get(tension.positionAId),
        ctx.db.get(tension.positionBId),
      ]);
      if (a && b && !a.excluded && !b.excluded) count += 1;
    }
    return count;
  },
});

export async function decideTension(
  ctx: MutationCtx,
  userId: string,
  tensionId: Id<"tensions">,
  decision: { status: "resolved"; resolution: string } | { status: "dismissed" },
): Promise<void> {
  const tension = await ctx.db.get(tensionId);
  if (!tension || tension.userId !== userId) {
    throw new Error("Tension not found");
  }
  if (tension.status !== "open") throw new Error("Tension already decided");
  if (decision.status === "resolved") {
    const resolution = decision.resolution.trim();
    if (!resolution) throw new Error("Resolution is empty");
    await ctx.db.patch(tensionId, {
      status: "resolved",
      resolution,
      decidedAt: Date.now(),
    });
  } else {
    await ctx.db.patch(tensionId, {
      status: "dismissed",
      decidedAt: Date.now(),
    });
  }
}

export const resolveTension = mutation({
  args: { tensionId: v.id("tensions"), resolution: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await decideTension(ctx, user._id, args.tensionId, {
      status: "resolved",
      resolution: args.resolution,
    });
  },
});

export const dismissTension = mutation({
  args: { tensionId: v.id("tensions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await decideTension(ctx, user._id, args.tensionId, { status: "dismissed" });
  },
});

/**
 * Dismissal-rate monitor (spec: >25% means the judgment prompt isn't ready).
 * Ops-only, all users, run via: bunx convex run tensions:qualityStats
 * Full-table read — acceptable for an internal ops query at current scale.
 */
export const qualityStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tensions").collect();
    const open = all.filter((t) => t.status === "open").length;
    const resolved = all.filter((t) => t.status === "resolved").length;
    const dismissed = all.filter((t) => t.status === "dismissed").length;
    const decided = resolved + dismissed;
    return {
      open,
      resolved,
      dismissed,
      dismissalRate: decided === 0 ? null : dismissed / decided,
    };
  },
});
```

- [ ] **Step 4: Cascade deletes in `profile.ts`**

In `packages/backend/convex/profile.ts`, add near `assertOwnPosition`:

```typescript
/** Cascade: a deleted position takes every tension referencing it along. */
export async function deleteTensionsReferencing(
  ctx: MutationCtx,
  userId: string,
  positionId: Id<"positions">,
): Promise<void> {
  const tensions = await ctx.db
    .query("tensions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const tension of tensions) {
    if (
      tension.positionAId === positionId ||
      tension.positionBId === positionId
    ) {
      await ctx.db.delete(tension._id);
    }
  }
}
```

In the `deletePosition` handler, before `await ctx.db.delete(args.positionId);`:

```typescript
    await deleteTensionsReferencing(ctx, user._id, args.positionId);
```

In the `deleteAllProfileData` handler, after the positions loop and before the settings delete:

```typescript
    const tensions = await ctx.db
      .query("tensions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const tension of tensions) {
      await ctx.db.delete(tension._id);
    }
```

- [ ] **Step 5: Run the full backend suite**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test`
Expected: PASS — all suites.

- [ ] **Step 6: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/tensions.ts packages/backend/convex/tensions.test.ts packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): tensions API — views, resolve/dismiss, cascade deletes, quality stats

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Tensions UI on `/profile`

**Files:**
- Create: `apps/web/src/components/profile/tensions-section.tsx`
- Create: `apps/web/src/components/profile/tensions-section.module.css`
- Modify: `apps/web/src/components/profile/profile-page.tsx` (render the section)

**Interfaces:**
- Consumes: `api.tensions.getTensions/resolveTension/dismissTension`, `api.chat.createConversation` (`{ mode, setup, firstMessage }` → `Id<"conversations">`), `buildStudyPrompt` from `@theologia/backend/convex/lib/tensions`, `usageLimitMessage(error): string | null` from `@/components/chat/lib/usage-limit`
- Produces: `<TensionsSection />` — renders nothing when there are no visible tensions; open cards with Study this / Resolved / Dismiss; quiet Resolved subsection

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/profile/tensions-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { buildStudyPrompt } from "@theologia/backend/convex/lib/tensions";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { usageLimitMessage } from "@/components/chat/lib/usage-limit";

import styles from "./tensions-section.module.css";

type TensionsData = NonNullable<FunctionReturnType<typeof api.tensions.getTensions>>;
type Tension = TensionsData["open"][number];

export default function TensionsSection() {
  const tensions = useQuery(api.tensions.getTensions);
  const resolveTension = useMutation(api.tensions.resolveTension);
  const dismissTension = useMutation(api.tensions.dismissTension);
  const createConversation = useMutation(api.chat.createConversation);
  const router = useRouter();

  const [resolvingId, setResolvingId] = useState<Id<"tensions"> | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [studyingId, setStudyingId] = useState<Id<"tensions"> | null>(null);

  if (!tensions) return null;
  if (tensions.open.length === 0 && tensions.resolved.length === 0) return null;

  async function handleStudy(tension: Tension) {
    if (!tension.studyFramework) return;
    setStudyingId(tension.id);
    try {
      const conversationId = await createConversation({
        mode: "qa",
        setup: { framework: tension.studyFramework },
        firstMessage: buildStudyPrompt(
          tension.positionA.statement,
          tension.positionB.statement,
        ),
      });
      router.push(`/chat?c=${conversationId}`);
    } catch (error) {
      toast.error(
        usageLimitMessage(error) ?? "Couldn't start the study conversation.",
      );
      setStudyingId(null);
    }
  }

  async function handleResolve(tension: Tension) {
    await resolveTension({ tensionId: tension.id, resolution: resolutionDraft });
    setResolvingId(null);
    setResolutionDraft("");
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionLabel}>Tensions</h2>
      <p className={styles.sectionLede}>
        Places where two things you have affirmed sit uneasily together —
        held up for study, not judgment.
      </p>

      {tensions.open.map((tension) => (
        <article key={tension.id} className={styles.card}>
          <blockquote className={styles.quote}>
            <p className={styles.statement}>{tension.positionA.statement}</p>
            <p className={styles.apparatus}>
              <Link
                href={`/chat?c=${tension.positionA.sourceConversationId}`}
                className={styles.sourceLink}
              >
                source conversation
              </Link>
            </p>
          </blockquote>
          <blockquote className={styles.quote}>
            <p className={styles.statement}>{tension.positionB.statement}</p>
            <p className={styles.apparatus}>
              <Link
                href={`/chat?c=${tension.positionB.sourceConversationId}`}
                className={styles.sourceLink}
              >
                source conversation
              </Link>
            </p>
          </blockquote>
          <p className={styles.description}>{tension.description}</p>
          {tension.historicalNote ? (
            <p className={styles.historicalNote}>{tension.historicalNote}</p>
          ) : null}

          {resolvingId === tension.id ? (
            <div className={styles.resolveRow}>
              <textarea
                className={styles.resolveArea}
                placeholder="In your own words, how did you resolve this?"
                value={resolutionDraft}
                onChange={(e) => setResolutionDraft(e.target.value)}
                rows={3}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={resolutionDraft.trim() === ""}
                  onClick={() => handleResolve(tension)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    setResolvingId(null);
                    setResolutionDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              {tension.studyFramework ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={studyingId === tension.id}
                  onClick={() => handleStudy(tension)}
                >
                  {studyingId === tension.id ? "Opening…" : "Study this"}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  setResolvingId(tension.id);
                  setResolutionDraft("");
                }}
              >
                Resolved
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => dismissTension({ tensionId: tension.id })}
              >
                Dismiss
              </button>
            </div>
          )}
        </article>
      ))}

      {tensions.resolved.length > 0 ? (
        <div className={styles.resolvedBlock}>
          <h3 className={styles.resolvedLabel}>Resolved</h3>
          {tensions.resolved.map((tension) => (
            <article key={tension.id} className={styles.resolvedItem}>
              <p className={styles.resolvedPair}>
                “{tension.positionA.statement}” · “{tension.positionB.statement}”
              </p>
              <p className={styles.resolution}>{tension.resolution}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Create the CSS module**

Create `apps/web/src/components/profile/tensions-section.module.css` (palette custom properties inherit from the profile page's `.root`, which always wraps this section):

```css
/* Tensions — the mirror. Same critical-edition register as the profile:
   Fraunces quotes, Geist Mono apparatus. A study partner, never a verdict. */

.section {
  border-bottom: 1px solid var(--hairline);
  padding-bottom: 2rem;
  margin-bottom: 2.5rem;
}

.sectionLabel {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gold);
  margin: 0 0 0.4rem;
}

.sectionLede {
  font-family: var(--font-inter), sans-serif;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--stone);
  margin: 0 0 1.4rem;
}

.card {
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 1.25rem 1.4rem;
  margin-bottom: 1.25rem;
}
.card:last-of-type {
  margin-bottom: 0;
}

.quote {
  border-left: 2px solid var(--hairline);
  margin: 0 0 0.9rem;
  padding-left: 0.9rem;
}

.statement {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  line-height: 1.35;
  color: var(--parchment);
  margin: 0 0 0.25rem;
}

.apparatus {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--stone);
  margin: 0;
}

.sourceLink {
  color: var(--gold);
  text-decoration: none;
}
.sourceLink:hover {
  color: var(--gold-bright);
  text-decoration: underline;
}

.description {
  font-family: var(--font-inter), sans-serif;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--parchment-dim);
  margin: 0 0 0.5rem;
}

.historicalNote {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.7rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
  color: var(--stone);
  margin: 0 0 0.75rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.actionButton {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--stone);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
}
.actionButton:hover {
  color: var(--gold-bright);
  border-color: var(--hairline);
}
.actionButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.resolveRow {
  margin-top: 0.5rem;
}
.resolveArea {
  width: 100%;
  font-family: var(--font-inter), sans-serif;
  font-size: 0.9rem;
  color: var(--parchment);
  background: rgba(11, 8, 5, 0.6);
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.6rem;
  margin-bottom: 0.5rem;
  resize: vertical;
}

.resolvedBlock {
  margin-top: 1.75rem;
}

.resolvedLabel {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--stone);
  margin: 0 0 0.75rem;
}

.resolvedItem {
  margin-bottom: 1rem;
}

.resolvedPair {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: var(--stone);
  margin: 0 0 0.25rem;
}

.resolution {
  font-family: var(--font-fraunces), serif;
  font-size: 1rem;
  font-style: italic;
  line-height: 1.4;
  color: var(--parchment-dim);
  margin: 0;
}
```

- [ ] **Step 3: Render the section on the profile page**

In `apps/web/src/components/profile/profile-page.tsx`:

Add the import (with the other component imports):

```tsx
import TensionsSection from "./tensions-section";
```

In the opted-in branch, between the closing `</div>` of `styles.controls` and `<main className={styles.loci}>`, add:

```tsx
          <TensionsSection />
```

- [ ] **Step 4: Format, type-check, test**

```bash
cd /Users/dylanwest/Coding/theologia/apps/web
bunx prettier --write src/components/profile/
bunx tsc --noEmit
bun run test
```

Expected: TSC PASS; all web tests pass. (If `buildStudyPrompt` fails to resolve from `@theologia/backend/convex/lib/tensions`, mirror exactly how `profile-page.tsx` imports `LOCI` from `@theologia/backend/convex/lib/profile` — the path form must match; do not copy the function into the web app.)

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/profile/tensions-section.tsx apps/web/src/components/profile/tensions-section.module.css apps/web/src/components/profile/profile-page.tsx
git commit -m "feat(web): tensions section on /profile — study this, resolve, dismiss

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Sidebar count badge + end-to-end verification

**Files:**
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`
- Modify: `apps/web/src/components/chat/chat-sidebar.module.css`

**Interfaces:**
- Consumes: `api.tensions.openCount` (Task 4), the existing "Your Theology" footer link (Phase 1)
- Produces: the link reads `Your Theology · N` when N > 0

- [ ] **Step 1: Add the count to the link**

In `apps/web/src/components/chat/chat-sidebar.tsx`, add to the imports:

```tsx
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";
```

(Keep the import group style Prettier settles on; `chat-sidebar.tsx` is a client component already.)

Inside the component body (top, with any other hooks):

```tsx
  const openTensions = useQuery(api.tensions.openCount);
```

Change the footer link:

```tsx
        <Link href="/profile" className={styles.profileLink}>
          Your Theology
          {openTensions ? (
            <span className={styles.tensionCount}> · {openTensions}</span>
          ) : null}
        </Link>
```

In `apps/web/src/components/chat/chat-sidebar.module.css`, after the `.profileLink` rules:

```css
.tensionCount {
  color: var(--gold, #c9a24e);
}
```

- [ ] **Step 2: Full verification**

```bash
cd /Users/dylanwest/Coding/theologia/packages/backend && bun run test
cd /Users/dylanwest/Coding/theologia/apps/web && bunx prettier --write src/components/chat/chat-sidebar.tsx && bunx tsc --noEmit && bun run test
```

Expected: all backend suites PASS; TSC PASS; all web tests PASS.

- [ ] **Step 3: Manual smoke test (dev deployment — requires Dylan)**

With `bun run dev` running (Convex dev + web on 3001) and the backend pushed (`bunx convex dev --once` from `packages/backend`):

1. Seed: as an opted-in paid user with ≥2 positions in the same/adjacent loci, run `internal.tensions.detectTensions` from the Convex dashboard with `{ userId, claimLoci: ["soteriology"], framework: "reformed" }`. Confirm `tensions` rows appear only for genuinely uneasy pairs (abstention works on harmonious sets).
2. `/profile`: tensions section renders between controls and loci; both quotes link to their source conversations; description and historical note read neutrally (no "contradiction" anywhere).
3. **Study this** → lands in a new `/chat?c=…` qa conversation whose first message quotes both positions; reply streams.
4. **Resolved** → textarea, save → card moves to the Resolved subsection with your words; **Dismiss** → card disappears.
5. Sidebar shows `Your Theology · N` matching open tensions; resolves/dismissals decrement it live.
6. Exclude a position that's in a tension → tension hides; un-exclude → returns. Delete a position in a tension → tension is gone permanently.
7. `bunx convex run tensions:qualityStats` → sane counts and rate.
8. Re-run `detectTensions` with the same loci → no duplicate tensions for covered pairs (open, resolved, or dismissed).

- [ ] **Step 4: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/chat/chat-sidebar.tsx apps/web/src/components/chat/chat-sidebar.module.css
git commit -m "feat(web): open-tension count on the Your Theology sidebar link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of Scope (Phase 3 — do not build)

Profile summary generation and prompt injection, tension followup chips in chat, development-over-time view, Batch API extraction, reopen/undo for decided tensions, admin dashboards.

## Known Deviations from the Spec Document

- The spec's single `buildTensionPrompt(positions, coveredPairs, framework?)` is split into `buildTensionSystemPrompt()` (static instructions/contract) + `buildTensionUserPrompt(positions, coveredIndexPairs, framework?)` (per-call content) — cleaner tests, same content.
- `getTensions` open-tension cap is applied server-side via `selectOpenTensions` (spec allows either side; server-side keeps payloads small and the rule in one tested place).
- `openCount` counts *visible* open tensions (excluded-position hiding applied), uncapped — so the badge never advertises tensions the page won't show.
- The parser enforces the banned word (`/contradict/i` drops the item) in addition to the prompt instructing against it — the spec's copy rule, made fail-closed.
