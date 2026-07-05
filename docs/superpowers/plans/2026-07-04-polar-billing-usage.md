# Polar Billing + Usage Metering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Polar subscriptions (checkout, plan state, customer portal) and real per-user usage metering with hard enforcement: free users get 20 queries/calendar month on Haiku; paid users get a weekly dollar budget on Sonnet 5.

**Architecture:** The `@convex-dev/agent` `usageHandler` records each generation's cost (micro-USD, per-model rate table) into an aggregate `(userId, weekStart)` row. Send mutations enforce limits before saving anything — free via a transactional monthly query counter, paid via the weekly dollar row. Plan identity comes from Polar's synced subscription (`productKey` → plan). The chat meter, free-tier banner, user menu, and landing pricing cards all read the same queries.

**Tech Stack:** Convex + `@convex-dev/polar` 0.9.x + `@convex-dev/agent` 0.6.x, `@ai-sdk/anthropic` (models `claude-sonnet-5`, `claude-haiku-4-5`), Next.js app in `apps/web`, vitest (+ `convex-test` for the recording mutation).

**Spec:** `docs/superpowers/specs/2026-07-04-polar-billing-usage-design.md`

## Global Constraints

- Monorepo uses **bun** (`bun.lock`); backend package is `packages/backend`, web app is `apps/web`. Run backend tests with `cd packages/backend && bun run test`.
- Metering unit is **micro-USD integers** (1 USD = 1,000,000 microUsd). Standard (non-intro) API rates: `claude-sonnet-5` $3/$15 per MTok (cache read 0.1×, cache write 1.25× of input); `claude-haiku-4-5` $1/$5.
- Weekly budgets (micro-USD): scholar 1_375_000, ministry 2_825_000, churchTeam 7_200_000. Free: **20 queries/calendar month**, no dollar budget.
- Week boundary: Monday 00:00 **UTC**. Month boundary: 1st 00:00 **UTC**.
- Typed enforcement error: `ConvexError({ code: "USAGE_LIMIT", planId })`.
- Model routing: free → `claude-haiku-4-5`; all paid → `claude-sonnet-5`.
- `packages/backend/convex/usage.ts` must NOT statically import `./polar` or `./auth`-heavy modules beyond what its own functions need — `convex-test` loads modules lazily per invoked function, and the recording tests must not touch component-backed modules.
- Existing code style: CSS modules, default-export React components, `useQuery`/`useMutation` from `convex/react`.

---

### Task 1: Plan table (`lib/plans.ts`)

**Files:**
- Create: `packages/backend/convex/lib/plans.ts`
- Test: `packages/backend/convex/lib/plans.test.ts`

**Interfaces:**
- Produces: `PlanId` (`"free" | "scholar" | "ministry" | "churchTeam"`), `Plan` (`{ id, label, model, weeklyBudgetMicroUsd }`), `PLANS: Record<PlanId, Plan>`, `FREE_MONTHLY_QUERY_LIMIT = 20`, `planFromProductKey(key: string | null | undefined): PlanId`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/convex/lib/plans.test.ts
import { describe, expect, test } from "vitest";

import { FREE_MONTHLY_QUERY_LIMIT, PLANS, planFromProductKey } from "./plans";

describe("planFromProductKey", () => {
  test("maps Polar product keys to plans", () => {
    expect(planFromProductKey("scholar")).toBe("scholar");
    expect(planFromProductKey("ministry")).toBe("ministry");
    expect(planFromProductKey("churchTeam")).toBe("churchTeam");
  });

  test("no subscription or unknown key means free", () => {
    expect(planFromProductKey(null)).toBe("free");
    expect(planFromProductKey(undefined)).toBe("free");
    expect(planFromProductKey("something-else")).toBe("free");
  });
});

describe("PLANS", () => {
  test("free runs Haiku with no dollar budget", () => {
    expect(PLANS.free.model).toBe("claude-haiku-4-5");
    expect(PLANS.free.weeklyBudgetMicroUsd).toBeNull();
    expect(FREE_MONTHLY_QUERY_LIMIT).toBe(20);
  });

  test("paid plans run Sonnet 5 with weekly budgets from PRICING.md", () => {
    expect(PLANS.scholar.model).toBe("claude-sonnet-5");
    expect(PLANS.scholar.weeklyBudgetMicroUsd).toBe(1_375_000);
    expect(PLANS.ministry.weeklyBudgetMicroUsd).toBe(2_825_000);
    expect(PLANS.churchTeam.weeklyBudgetMicroUsd).toBe(7_200_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bunx vitest run lib/plans`
Expected: FAIL — `Cannot find module './plans'` (or equivalent resolution error).

- [ ] **Step 3: Write the implementation**

```ts
// packages/backend/convex/lib/plans.ts
// Canonical plan table. Budgets come from docs/PRICING.md (monthly API
// budget ÷ 4, in micro-USD). Free is query-counted, not dollar-metered.

export type PlanId = "free" | "scholar" | "ministry" | "churchTeam";

export type Plan = {
  id: PlanId;
  label: string;
  /** Anthropic model ID this plan's replies run on. */
  model: string;
  /** Weekly API budget in micro-USD; null for the query-counted free tier. */
  weeklyBudgetMicroUsd: number | null;
};

export const FREE_MONTHLY_QUERY_LIMIT = 20;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    model: "claude-haiku-4-5",
    weeklyBudgetMicroUsd: null,
  },
  scholar: {
    id: "scholar",
    label: "Scholar",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 1_375_000,
  },
  ministry: {
    id: "ministry",
    label: "Ministry",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 2_825_000,
  },
  churchTeam: {
    id: "churchTeam",
    label: "Church Team",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 7_200_000,
  },
};

export function planFromProductKey(
  key: string | null | undefined,
): PlanId {
  switch (key) {
    case "scholar":
    case "ministry":
    case "churchTeam":
      return key;
    default:
      return "free";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && bunx vitest run lib/plans`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/plans.ts packages/backend/convex/lib/plans.test.ts
git commit -m "feat(backend): canonical plan table with per-plan model and budgets"
```

---

### Task 2: Usage math (`lib/usageMath.ts`)

**Files:**
- Create: `packages/backend/convex/lib/usageMath.ts`
- Test: `packages/backend/convex/lib/usageMath.test.ts`

**Interfaces:**
- Produces:
  - `TokenCounts = { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }`
  - `costMicroUsd(model: string, tokens: TokenCounts): number` — integer micro-USD, rounded up; unknown models bill at the Sonnet 5 rate.
  - `weekStartUtc(now: number): number` / `nextWeeklyResetUtc(now: number): number` — Monday 00:00 UTC boundaries (ms epoch).
  - `monthStartUtc(now: number): number` / `nextMonthlyResetUtc(now: number): number` — 1st 00:00 UTC boundaries (ms epoch).

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/convex/lib/usageMath.test.ts
import { describe, expect, test } from "vitest";

import {
  costMicroUsd,
  monthStartUtc,
  nextMonthlyResetUtc,
  nextWeeklyResetUtc,
  weekStartUtc,
} from "./usageMath";

describe("costMicroUsd", () => {
  test("sonnet-5 typical query: 8k cached-read input, 500 uncached, 1.5k output", () => {
    // 500 × 3 + 1500 × 15 + 8000 × 0.3 + 0 = 1500 + 22500 + 2400 = 26400
    expect(
      costMicroUsd("claude-sonnet-5", {
        uncachedInputTokens: 500,
        outputTokens: 1500,
        cacheReadTokens: 8000,
        cacheWriteTokens: 0,
      }),
    ).toBe(26_400);
  });

  test("haiku rates", () => {
    // 1000 × 1 + 1000 × 5 + 1000 × 0.1 + 1000 × 1.25 = 7350
    expect(
      costMicroUsd("claude-haiku-4-5", {
        uncachedInputTokens: 1000,
        outputTokens: 1000,
        cacheReadTokens: 1000,
        cacheWriteTokens: 1000,
      }),
    ).toBe(7_350);
  });

  test("rounds fractional micro-USD up", () => {
    // 1 cache-read token on sonnet = 0.3 microUsd → ceil to 1
    expect(
      costMicroUsd("claude-sonnet-5", {
        uncachedInputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 1,
        cacheWriteTokens: 0,
      }),
    ).toBe(1);
  });

  test("unknown model bills at the sonnet-5 rate", () => {
    const tokens = {
      uncachedInputTokens: 100,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    expect(costMicroUsd("mystery-model", tokens)).toBe(
      costMicroUsd("claude-sonnet-5", tokens),
    );
  });
});

describe("week boundaries (Monday 00:00 UTC)", () => {
  // 2026-07-04 is a Saturday; the week started Monday 2026-06-29.
  const saturday = Date.UTC(2026, 6, 4, 15, 30);

  test("weekStartUtc from a mid-week instant", () => {
    expect(weekStartUtc(saturday)).toBe(Date.UTC(2026, 5, 29));
  });

  test("a Monday at 00:00 UTC is its own week start", () => {
    const monday = Date.UTC(2026, 5, 29);
    expect(weekStartUtc(monday)).toBe(monday);
  });

  test("Sunday belongs to the previous Monday's week", () => {
    const sunday = Date.UTC(2026, 6, 5, 23, 59);
    expect(weekStartUtc(sunday)).toBe(Date.UTC(2026, 5, 29));
  });

  test("nextWeeklyResetUtc is the following Monday", () => {
    expect(nextWeeklyResetUtc(saturday)).toBe(Date.UTC(2026, 6, 6));
  });
});

describe("month boundaries (1st 00:00 UTC)", () => {
  test("monthStartUtc", () => {
    expect(monthStartUtc(Date.UTC(2026, 6, 4, 12))).toBe(Date.UTC(2026, 6, 1));
  });

  test("nextMonthlyResetUtc rolls the year over from December", () => {
    expect(nextMonthlyResetUtc(Date.UTC(2026, 11, 31, 23))).toBe(
      Date.UTC(2027, 0, 1),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && bunx vitest run lib/usageMath`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/backend/convex/lib/usageMath.ts
// Cost + time-window math for usage metering. Rates are standard (non-intro)
// Anthropic API pricing in micro-USD per token ($/MTok == microUsd/token).

export type TokenCounts = {
  uncachedInputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type Rate = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

const MODEL_RATES: Record<string, Rate> = {
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function costMicroUsd(model: string, tokens: TokenCounts): number {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["claude-sonnet-5"];
  if (!(model in MODEL_RATES)) {
    console.warn(`usageMath: unknown model "${model}", billing at sonnet-5 rate`);
  }
  return Math.ceil(
    tokens.uncachedInputTokens * rate.input +
      tokens.outputTokens * rate.output +
      tokens.cacheReadTokens * rate.cacheRead +
      tokens.cacheWriteTokens * rate.cacheWrite,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function weekStartUtc(now: number): number {
  const d = new Date(now);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    daysSinceMonday * DAY_MS
  );
}

export function nextWeeklyResetUtc(now: number): number {
  return weekStartUtc(now) + 7 * DAY_MS;
}

export function monthStartUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function nextMonthlyResetUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && bunx vitest run lib/usageMath`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/usageMath.ts packages/backend/convex/lib/usageMath.test.ts
git commit -m "feat(backend): usage cost and UTC window math"
```

---

### Task 3: Schema — `usageWeeks` and `usageMonths`

**Files:**
- Modify: `packages/backend/convex/schema.ts`

**Interfaces:**
- Produces: tables `usageWeeks` (index `by_user_week` on `[userId, weekStart]`) and `usageMonths` (index `by_user_month` on `[userId, monthStart]`).

- [ ] **Step 1: Add the tables**

In `packages/backend/convex/schema.ts`, add to the `defineSchema({ ... })` object after `conversations`:

```ts
  usageWeeks: defineTable({
    userId: v.string(),
    weekStart: v.number(), // ms epoch of Monday 00:00 UTC
    microUsd: v.number(), // accumulated API cost, millionths of a dollar
    inputTokens: v.number(), // uncached input tokens
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
  }).index("by_user_week", ["userId", "weekStart"]),

  usageMonths: defineTable({
    userId: v.string(),
    monthStart: v.number(), // ms epoch of the 1st, 00:00 UTC
    queries: v.number(), // free-tier query counter
  }).index("by_user_month", ["userId", "monthStart"]),
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd packages/backend && bunx tsc -p convex`
Expected: no new errors (`convex/tsconfig.json` already sets `noEmit`).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/schema.ts
git commit -m "feat(backend): usageWeeks and usageMonths tables"
```

---

### Task 4: `usage.ts` — recording, enforcement, getUsage (+ convex-test)

**Files:**
- Create: `packages/backend/convex/usage.ts`
- Test: `packages/backend/convex/usage.test.ts`
- Modify: `packages/backend/package.json` (dev deps), `packages/backend/vitest.config.ts`

**Interfaces:**
- Consumes: `PLANS`, `PlanId`, `FREE_MONTHLY_QUERY_LIMIT`, `planFromProductKey` (Task 1); `costMicroUsd`, window fns (Task 2); tables (Task 3). References `api.polar.getPlanForCurrentUser` (defined in Task 5) — a function-reference only, no module import.
- Produces:
  - `internal.usage.recordUsage` — internal mutation `{ userId, model, uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }`.
  - `usageHandler: UsageHandler` — for the Agent constructor (Task 6).
  - `assertUnderLimitAndCount(ctx: MutationCtx, userId: string, planId: PlanId): Promise<void>` — throws `ConvexError({ code: "USAGE_LIMIT", planId })`; increments the free monthly counter.
  - `api.usage.getUsage` — public query returning
    `{ planId: "free", planLabel, kind: "queries", used, limit, resetsAt } | { planId, planLabel, kind: "budget", usedUsd, weeklyBudgetUsd, resetsAt } | null`.

- [ ] **Step 1: Install convex-test**

```bash
cd packages/backend && bun add -d convex-test @edge-runtime/vm
```

- [ ] **Step 2: Update vitest config to inline convex-test**

Replace `packages/backend/vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

(The convex-test file opts into the edge runtime per-file via a `@vitest-environment` pragma; other tests stay on node.)

- [ ] **Step 3: Write the failing test**

```ts
// packages/backend/convex/usage.test.ts
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("recordUsage", () => {
  test("inserts a week row and accumulates on repeat", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.usage.recordUsage, {
      userId: "user1",
      model: "claude-sonnet-5",
      uncachedInputTokens: 500,
      outputTokens: 1500,
      cacheReadTokens: 8000,
      cacheWriteTokens: 0,
    });
    await t.mutation(internal.usage.recordUsage, {
      userId: "user1",
      model: "claude-sonnet-5",
      uncachedInputTokens: 500,
      outputTokens: 1500,
      cacheReadTokens: 8000,
      cacheWriteTokens: 0,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("usageWeeks").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].microUsd).toBe(52_800); // 2 × 26,400 (see usageMath tests)
    expect(rows[0].outputTokens).toBe(3000);
    expect(rows[0].cacheReadTokens).toBe(16_000);
  });

  test("separate users get separate rows", async () => {
    const t = convexTest(schema, modules);
    const args = {
      model: "claude-haiku-4-5",
      uncachedInputTokens: 100,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    await t.mutation(internal.usage.recordUsage, { userId: "a", ...args });
    await t.mutation(internal.usage.recordUsage, { userId: "b", ...args });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("usageWeeks").collect(),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("assertUnderLimitAndCount", () => {
  // t.run provides a real mutation-style ctx, so the plain helper is
  // testable without going through the (component-heavy) chat mutations.
  test("free: counts queries and blocks at 20", async () => {
    const t = convexTest(schema, modules);
    const { assertUnderLimitAndCount } = await import("./usage");

    await t.run(async (ctx) => {
      for (let i = 0; i < 20; i++) {
        await assertUnderLimitAndCount(ctx as never, "freeUser", "free");
      }
      const rows = await ctx.db.query("usageMonths").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].queries).toBe(20);

      await expect(
        assertUnderLimitAndCount(ctx as never, "freeUser", "free"),
      ).rejects.toMatchObject({ data: { code: "USAGE_LIMIT", planId: "free" } });
    });
  });

  test("paid: blocks at the weekly budget, does not touch the query counter", async () => {
    const t = convexTest(schema, modules);
    const { assertUnderLimitAndCount } = await import("./usage");

    await t.run(async (ctx) => {
      // Under budget: allowed.
      await assertUnderLimitAndCount(ctx as never, "scholarUser", "scholar");

      // At budget (1_375_000 microUsd): blocked.
      const { weekStartUtc } = await import("./lib/usageMath");
      await ctx.db.insert("usageWeeks", {
        userId: "scholarUser",
        weekStart: weekStartUtc(Date.now()),
        microUsd: 1_375_000,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      await expect(
        assertUnderLimitAndCount(ctx as never, "scholarUser", "scholar"),
      ).rejects.toMatchObject({
        data: { code: "USAGE_LIMIT", planId: "scholar" },
      });

      const months = await ctx.db.query("usageMonths").collect();
      expect(months).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/backend && bunx vitest run convex/usage.test.ts`
Expected: FAIL — `internal.usage` does not exist yet.

- [ ] **Step 5: Write `usage.ts`**

```ts
// packages/backend/convex/usage.ts
// Usage metering: recording (via the agent usageHandler), enforcement
// (called from chat mutations), and the meter query.
//
// NOTE: this module must not statically import ./polar — convex-test loads
// modules lazily per invoked function, and recordUsage tests must not pull
// in component-backed modules. Plan lookup goes through api/internal refs.

import type { UsageHandler } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  FREE_MONTHLY_QUERY_LIMIT,
  PLANS,
  type PlanId,
} from "./lib/plans";
import {
  costMicroUsd,
  monthStartUtc,
  nextMonthlyResetUtc,
  nextWeeklyResetUtc,
  weekStartUtc,
} from "./lib/usageMath";

export const recordUsage = internalMutation({
  args: {
    userId: v.string(),
    model: v.string(),
    uncachedInputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const weekStart = weekStartUtc(Date.now());
    const micro = costMicroUsd(args.model, args);
    const existing = await ctx.db
      .query("usageWeeks")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekStart", weekStart),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        microUsd: existing.microUsd + micro,
        inputTokens: existing.inputTokens + args.uncachedInputTokens,
        outputTokens: existing.outputTokens + args.outputTokens,
        cacheReadTokens: existing.cacheReadTokens + args.cacheReadTokens,
        cacheWriteTokens: existing.cacheWriteTokens + args.cacheWriteTokens,
      });
    } else {
      await ctx.db.insert("usageWeeks", {
        userId: args.userId,
        weekStart,
        microUsd: micro,
        inputTokens: args.uncachedInputTokens,
        outputTokens: args.outputTokens,
        cacheReadTokens: args.cacheReadTokens,
        cacheWriteTokens: args.cacheWriteTokens,
      });
    }
  },
});

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Wired into the Agent constructor (chat.ts); fires after each generation.
 * AI SDK v6 semantics: usage.inputTokens INCLUDES cached tokens, and the
 * Anthropic provider reports cache write tokens in providerMetadata.
 * Verify once against a real generation (see the env-setup task) — if
 * inputTokens turns out to exclude cache tokens, drop the subtraction.
 */
export const usageHandler: UsageHandler = async (ctx, args) => {
  if (!args.userId) return;
  const meta = (args.providerMetadata?.anthropic ?? {}) as Record<
    string,
    unknown
  >;
  const cacheWriteTokens = toCount(meta.cacheCreationInputTokens);
  const cacheReadTokens =
    args.usage.cachedInputTokens ?? toCount(meta.cacheReadInputTokens);
  const inputTokens = toCount(args.usage.inputTokens);
  const outputTokens = toCount(args.usage.outputTokens);
  const uncachedInputTokens = Math.max(
    0,
    inputTokens - cacheReadTokens - cacheWriteTokens,
  );
  try {
    await ctx.runMutation(internal.usage.recordUsage, {
      userId: args.userId,
      model: args.model,
      uncachedInputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });
  } catch (error) {
    // Metering must never take down a reply; worst case is one unmetered
    // generation, which we log.
    console.error("usageHandler: failed to record usage", error);
  }
};

/**
 * Enforcement, called from chat mutations BEFORE saving the prompt.
 * Free: hard 20 queries/calendar month, counted transactionally here.
 * Paid: hard cap at 100% of the weekly budget.
 */
export async function assertUnderLimitAndCount(
  ctx: MutationCtx,
  userId: string,
  planId: PlanId,
): Promise<void> {
  const now = Date.now();
  const plan = PLANS[planId];
  if (plan.weeklyBudgetMicroUsd === null) {
    const monthStart = monthStartUtc(now);
    const row = await ctx.db
      .query("usageMonths")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthStart", monthStart),
      )
      .unique();
    if ((row?.queries ?? 0) >= FREE_MONTHLY_QUERY_LIMIT) {
      throw new ConvexError({ code: "USAGE_LIMIT", planId });
    }
    if (row) {
      await ctx.db.patch(row._id, { queries: row.queries + 1 });
    } else {
      await ctx.db.insert("usageMonths", { userId, monthStart, queries: 1 });
    }
    return;
  }
  const weekStart = weekStartUtc(now);
  const row = await ctx.db
    .query("usageWeeks")
    .withIndex("by_user_week", (q) =>
      q.eq("userId", userId).eq("weekStart", weekStart),
    )
    .unique();
  if ((row?.microUsd ?? 0) >= plan.weeklyBudgetMicroUsd) {
    throw new ConvexError({ code: "USAGE_LIMIT", planId });
  }
}

export type UsageSummary =
  | {
      planId: "free";
      planLabel: string;
      kind: "queries";
      used: number;
      limit: number;
      resetsAt: number;
    }
  | {
      planId: PlanId;
      planLabel: string;
      kind: "budget";
      usedUsd: number;
      weeklyBudgetUsd: number;
      resetsAt: number;
    };

export const getUsage = query({
  args: {},
  handler: async (ctx): Promise<UsageSummary | null> => {
    const result: { userId: string; planId: PlanId } | null =
      await ctx.runQuery(api.polar.getPlanForCurrentUser, {});
    if (!result) return null;
    const { userId, planId } = result;
    const plan = PLANS[planId];
    const now = Date.now();

    if (plan.weeklyBudgetMicroUsd === null) {
      const row = await ctx.db
        .query("usageMonths")
        .withIndex("by_user_month", (q) =>
          q.eq("userId", userId).eq("monthStart", monthStartUtc(now)),
        )
        .unique();
      return {
        planId: "free",
        planLabel: plan.label,
        kind: "queries",
        used: row?.queries ?? 0,
        limit: FREE_MONTHLY_QUERY_LIMIT,
        resetsAt: nextMonthlyResetUtc(now),
      };
    }

    const row = await ctx.db
      .query("usageWeeks")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekStart", weekStartUtc(now)),
      )
      .unique();
    return {
      planId,
      planLabel: plan.label,
      kind: "budget",
      usedUsd: (row?.microUsd ?? 0) / 1_000_000,
      weeklyBudgetUsd: plan.weeklyBudgetMicroUsd / 1_000_000,
      resetsAt: nextWeeklyResetUtc(now),
    };
  },
});
```

Note: `getUsage` won't typecheck until `api.polar.getPlanForCurrentUser` exists (Task 5). If working strictly task-by-task, expect a temporary TS error on that line only; the convex-test suite still passes because it never invokes `getUsage`.

- [ ] **Step 6: Run tests**

Run: `cd packages/backend && bun run test`
Expected: usage.test.ts PASS (4 tests); plans/usageMath/prompts tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/usage.ts packages/backend/convex/usage.test.ts packages/backend/vitest.config.ts packages/backend/package.json bun.lock
git commit -m "feat(backend): usage recording, enforcement, and meter query"
```

---

### Task 5: Polar plan resolution (`polar.ts`)

**Files:**
- Modify: `packages/backend/convex/polar.ts`

**Interfaces:**
- Consumes: `planFromProductKey`, `PlanId` (Task 1).
- Produces:
  - `Polar` client configured with `products: { scholar, ministry, churchTeam }` from env vars `POLAR_PRODUCT_SCHOLAR` / `POLAR_PRODUCT_MINISTRY` / `POLAR_PRODUCT_CHURCH_TEAM`.
  - `getPlanIdForUser(ctx, userId): Promise<PlanId>` — plain exported async fn (for chat.ts).
  - `api.polar.getPlanForCurrentUser` — query returning `{ userId: string; planId: PlanId } | null` (for usage.getUsage).

- [ ] **Step 1: Configure products and add plan resolution**

In `packages/backend/convex/polar.ts`:

Add imports:

```ts
import { planFromProductKey, type PlanId } from "./lib/plans";
```

Update the constructor call to include products:

```ts
export const polar: Polar<DataModel> = new Polar<DataModel>(components.polar, {
  getUserInfo: async (ctx) => {
    // ... unchanged ...
  },
  products: {
    scholar: process.env.POLAR_PRODUCT_SCHOLAR!,
    ministry: process.env.POLAR_PRODUCT_MINISTRY!,
    churchTeam: process.env.POLAR_PRODUCT_CHURCH_TEAM!,
  },
});
```

Add below `getCurrentSubscription`:

```ts
type RunQueryCtx = Parameters<Polar<DataModel>["getCurrentSubscription"]>[0];

/** Resolve a user's plan from their Polar subscription. No sub → free. */
export async function getPlanIdForUser(
  ctx: RunQueryCtx,
  userId: string,
): Promise<PlanId> {
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  return planFromProductKey(subscription?.productKey);
}

export const getPlanForCurrentUser = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ userId: string; planId: PlanId } | null> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser);
    if (!user) return null;
    return {
      userId: user._id,
      planId: await getPlanIdForUser(ctx, user._id),
    };
  },
});
```

If the `Parameters<...>[0]` trick fights the compiler, fall back to typing `ctx` as `QueryCtx | MutationCtx | ActionCtx` from `./_generated/server` — the Polar client only needs `runQuery`.

- [ ] **Step 2: Typecheck**

Run: `cd packages/backend && bunx tsc -p convex` (from the directory whose tsconfig covers `convex/`).
Expected: the Task 4 temporary error on `api.polar.getPlanForCurrentUser` is now gone; no new errors. (Run `bunx convex codegen` first if `_generated/api` hasn't picked up the new exports.)

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/polar.ts
git commit -m "feat(backend): map Polar product keys to plans"
```

---

### Task 6: Chat wiring — usageHandler, enforcement, per-plan models

**Files:**
- Modify: `packages/backend/convex/chat.ts`

**Interfaces:**
- Consumes: `usageHandler`, `assertUnderLimitAndCount` (Task 4); `getPlanIdForUser` (Task 5); `PLANS` (Task 1).
- Produces: `createConversation` / `sendMessage` throw `ConvexError({ code: "USAGE_LIMIT", planId })` when over limit; `streamReply` runs free users on Haiku and paid users on Sonnet 5.

- [ ] **Step 1: Update the agent constructor**

In `packages/backend/convex/chat.ts`, add imports:

```ts
import { PLANS } from "./lib/plans";
import { getPlanIdForUser } from "./polar";
import { assertUnderLimitAndCount, usageHandler } from "./usage";
```

Change the agent definition (default model becomes Sonnet 5, per spec — paid tier model; free is overridden per-call):

```ts
export const theologiaAgent = new Agent(components.agent, {
  name: "Theologia",
  languageModel: anthropic("claude-sonnet-5"),
  usageHandler,
});
```

- [ ] **Step 2: Enforce in `createConversation`**

After `const user = await requireUser(ctx);` and the setup/text validation (keep validation first so bad input fails before consuming a free query — actually order matters the other way: enforce BEFORE incrementing on invalid input. Put the limit check after the `text` emptiness check so an empty message never consumes a query):

```ts
    const text = args.firstMessage.trim();
    if (!text) throw new Error("Message is empty");

    const planId = await getPlanIdForUser(ctx, user._id);
    await assertUnderLimitAndCount(ctx, user._id, planId);
```

(Leave everything after — `createThread`, `saveMessage`, insert, schedule — unchanged.)

- [ ] **Step 3: Enforce in `sendMessage`**

Same placement — after the `text` emptiness check, before `saveMessage`:

```ts
    const text = args.text.trim();
    if (!text) throw new Error("Message is empty");

    const planId = await getPlanIdForUser(ctx, user._id);
    await assertUnderLimitAndCount(ctx, user._id, planId);
```

- [ ] **Step 4: Per-plan model in `streamReply`**

In the `streamReply` handler, after the conversation null-check:

```ts
    const planId = await getPlanIdForUser(ctx, conversation.userId);
    const model = anthropic(PLANS[planId].model);
```

and pass the override in the third argument of `streamText` (the `AgentPrompt` object supports `model`):

```ts
      const result = await theologiaAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId, system, model },
        { saveStreamDeltas: { chunking: "word" } },
      );
```

- [ ] **Step 5: Typecheck and run tests**

Run: `cd packages/backend && bunx tsc -p convex && bun run test`
Expected: clean typecheck; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/chat.ts
git commit -m "feat(backend): enforce usage limits and route models per plan"
```

---

### Task 7: Convex env setup + live verification (requires Dylan)

**Files:** none (deployment configuration).

This task needs values from `apps/web/.env` and the Polar dashboard. **Pause and ask Dylan to run:**

```bash
cd packages/backend
bunx convex env set POLAR_ORGANIZATION_TOKEN <POLAR_TEST_API value from apps/web/.env>
bunx convex env set POLAR_WEBHOOK_SECRET <secret from the Polar sandbox webhook, created below>
bunx convex env set POLAR_SERVER sandbox
bunx convex env set POLAR_PRODUCT_SCHOLAR <SCHOLAR_TEST_ID value>
bunx convex env set POLAR_PRODUCT_MINISTRY <MINISTRY_TEST_ID value>
bunx convex env set POLAR_PRODUCT_CHURCH_TEAM <CHURCH_TEAM_TEST_ID value>
```

And in the Polar sandbox dashboard: create a webhook pointing at `<NEXT_PUBLIC_CONVEX_SITE_URL>/polar/events` with events `product.created`, `product.updated`, `subscription.created`, `subscription.updated` enabled.

- [ ] **Step 1: Dylan sets the env vars and webhook** (above).
- [ ] **Step 2: Deploy and sync products**

With `bunx convex dev` running (or after a push), call the existing sync action once from the Convex dashboard or:

```bash
cd packages/backend && bunx convex run polar:syncProducts
```

(`syncProducts` requires an authenticated user when called via the client; running from the CLI as an admin bypasses UI auth — if it throws on auth, trigger it once from the app while signed in instead.)

- [ ] **Step 3: Verify token accounting against one real generation**

Send one chat message in dev, then check the Convex logs for the `usageHandler` inputs and the `usageWeeks` row. Confirm `inputTokens` (AI SDK) ≥ `cacheReadTokens + cacheWriteTokens` (i.e., it reports totals and the subtraction in `usageHandler` is correct). If instead `inputTokens` is already the uncached count (sum relationship doesn't hold), remove the subtraction in `usageHandler` (`uncachedInputTokens = inputTokens`) and note it in the commit.

- [ ] **Step 4: Commit any adjustment**

```bash
git add packages/backend/convex/usage.ts
git commit -m "fix(backend): align token extraction with observed AI SDK usage shape"
```

(Skip if no adjustment was needed.)

---

### Task 8: Chat usage meter on real data

**Files:**
- Modify: `apps/web/src/components/chat/chat-usage-meter.tsx`
- Modify: `apps/web/src/components/chat/chat-usage-meter.module.css`
- Delete: `apps/web/src/components/chat/lib/mock-usage.ts`

**Interfaces:**
- Consumes: `api.usage.getUsage` (Task 4), `api.polar.getConfiguredProducts` + `api.polar.generateCheckoutLink` (existing exports).

- [ ] **Step 1: Rewrite the meter**

Replace `apps/web/src/components/chat/chat-usage-meter.tsx` with:

```tsx
"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import styles from "./chat-usage-meter.module.css";

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export default function ChatUsageMeter() {
  const usage = useQuery(api.usage.getUsage);
  const products = useQuery(api.polar.getConfiguredProducts);

  // Countdown depends on client time — compute after mount to avoid a
  // server/client hydration mismatch, then tick every minute.
  const resetsAt = usage?.resetsAt;
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (resetsAt === undefined) return;
    function tick() {
      setCountdown(formatCountdown(resetsAt! - Date.now()));
    }
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [resetsAt]);

  if (!usage) return null;

  const fraction =
    usage.kind === "queries"
      ? Math.min(usage.used / usage.limit, 1)
      : Math.min(usage.usedUsd / usage.weeklyBudgetUsd, 1);
  const percent = Math.round(fraction * 100);
  const atLimit = fraction >= 1;

  const cardLabel =
    usage.kind === "queries" ? "Monthly queries" : "Weekly usage";
  const cardValue =
    usage.kind === "queries" ? `${usage.used} / ${usage.limit}` : `${percent}%`;

  const upgradeIds =
    usage.planId !== "churchTeam" && products
      ? [products.scholar, products.ministry, products.churchTeam]
          .filter((p) => p != null)
          .map((p) => p.id)
      : [];

  return (
    <div className={styles.meter}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`${cardLabel}: ${cardValue} used, resets in ${countdown}`}
      >
        <svg viewBox="0 0 20 20" className={styles.ring} aria-hidden="true">
          <circle className={styles.track} cx="10" cy="10" r={RADIUS} />
          <circle
            className={styles.progress}
            cx="10"
            cy="10"
            r={RADIUS}
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            transform="rotate(-90 10 10)"
          />
        </svg>
      </button>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardLabel}>{cardLabel}</span>
          <span className={styles.percent}>{cardValue}</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.reset}>
          {usage.planLabel} plan · Resets in {countdown}
        </span>
        {atLimit ? (
          <span className={styles.limit}>
            Limit reached — upgrade or wait for the reset.
          </span>
        ) : null}
        {upgradeIds.length > 0 ? (
          <CheckoutLink
            polarApi={api.polar}
            productIds={upgradeIds}
            className={styles.upgrade}
          >
            Upgrade
          </CheckoutLink>
        ) : null}
      </div>
    </div>
  );
}
```

Note the hover card loses `aria-hidden` because it now contains an interactive link; keep the existing CSS hover/focus reveal behavior.

- [ ] **Step 2: Add card styles**

Append to `chat-usage-meter.module.css` (match existing custom-property/typography conventions in that file when implementing):

```css
.limit {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--destructive, #b3382c);
}

.upgrade {
  display: inline-block;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
```

- [ ] **Step 3: Delete the mock**

```bash
rm apps/web/src/components/chat/lib/mock-usage.ts
```

Then grep for stragglers: `grep -rn "mock-usage" apps/web/src` — expect no hits.

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/components/chat
git commit -m "feat(web): usage meter on real per-plan data with upgrade link"
```

---

### Task 9: Free-tier upgrade banner on /chat

**Files:**
- Create: `apps/web/src/components/chat/chat-upgrade-banner.tsx`
- Create: `apps/web/src/components/chat/chat-upgrade-banner.module.css`
- Modify: `apps/web/src/components/chat/chat-app.tsx`

**Interfaces:**
- Consumes: `api.usage.getUsage`, `api.polar.getConfiguredProducts`.

- [ ] **Step 1: Create the banner component**

```tsx
// apps/web/src/components/chat/chat-upgrade-banner.tsx
"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import styles from "./chat-upgrade-banner.module.css";

export default function ChatUpgradeBanner() {
  const usage = useQuery(api.usage.getUsage);
  const products = useQuery(api.polar.getConfiguredProducts);

  if (usage?.planId !== "free") return null;

  const productIds = products
    ? [products.scholar, products.ministry, products.churchTeam]
        .filter((p) => p != null)
        .map((p) => p.id)
    : [];

  return (
    <div className={styles.banner}>
      <span>
        You&rsquo;re on the Free plan — upgrade for increased usage and better
        outputs.
      </span>
      {productIds.length > 0 ? (
        <CheckoutLink
          polarApi={api.polar}
          productIds={productIds}
          className={styles.cta}
        >
          Upgrade
        </CheckoutLink>
      ) : null}
    </div>
  );
}
```

```css
/* apps/web/src/components/chat/chat-upgrade-banner.module.css */
.banner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 16px;
  font-size: 12.5px;
  text-align: center;
}

.cta {
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  white-space: nowrap;
}
```

(Sample the banner background/border/text colors from the custom properties already used in `chat-app.module.css` so it sits on the fresco backdrop legibly.)

- [ ] **Step 2: Render it in chat-app**

In `apps/web/src/components/chat/chat-app.tsx`, import it and render inside `<main>` above the content div:

```tsx
import ChatUpgradeBanner from "./chat-upgrade-banner";
```

```tsx
        <main className={styles.main}>
          <div className={styles.fresco} aria-hidden />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.grain} aria-hidden />
          <ChatUpgradeBanner />
          <div className={styles.content}>
```

- [ ] **Step 3: Typecheck and eyeball**

Run: `cd apps/web && bunx tsc --noEmit` — clean.
With dev running and a free (no-subscription) user signed in, the banner shows on `/chat`; a subscribed user sees nothing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/chat-upgrade-banner.tsx apps/web/src/components/chat/chat-upgrade-banner.module.css apps/web/src/components/chat/chat-app.tsx
git commit -m "feat(web): free-tier upgrade banner on chat page"
```

---

### Task 10: Manage Subscription in the user menu

**Files:**
- Modify: `apps/web/src/components/user-menu.tsx`

**Interfaces:**
- Consumes: `api.polar.getCurrentSubscription`, `api.polar.generateCustomerPortalUrl` (existing exports).

- [ ] **Step 1: Add the portal link**

In `user-menu.tsx`, add imports:

```tsx
import { CustomerPortalLink } from "@convex-dev/polar/react";
```

Add the query beside the existing one:

```tsx
  const subscription = useQuery(api.polar.getCurrentSubscription);
```

Insert a new item between the email item and Sign Out:

```tsx
          {subscription ? (
            <DropdownMenuItem>
              <CustomerPortalLink
                polarApi={{
                  generateCustomerPortalUrl: api.polar.generateCustomerPortalUrl,
                }}
              >
                Manage Subscription
              </CustomerPortalLink>
            </DropdownMenuItem>
          ) : null}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit` — clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/user-menu.tsx
git commit -m "feat(web): manage-subscription link in user menu"
```

---

### Task 11: Landing pricing cards → checkout

**Files:**
- Modify: `apps/web/src/components/hero.tsx`
- Modify: `apps/web/src/components/hero.module.css`

**Interfaces:**
- Consumes: `api.auth.getCurrentUser`, `api.polar.getConfiguredProducts`, `api.polar.generateCheckoutLink`.

- [ ] **Step 1: Tag PRICING entries with product keys**

In `hero.tsx`, extend the `PRICING` array entries with a `productKey` field (`null` for Free):

```ts
const PRICING = [
  { plan: "Free", price: "$0", period: "/mo", productKey: null,
    desc: "Limited usage · 20 queries/month · Framework Q&A" },
  { plan: "Scholar", price: "$19", period: "/mo", productKey: "scholar",
    desc: "Standard usage · Devil's Advocate · Comparison · Resource Engine" },
  { plan: "Ministry", price: "$39", period: "/mo", productKey: "ministry",
    desc: "Increased usage · All Scholar + Debate Prep · Catechism Tutor · Patristic Library · Scripture Study · Export" },
  { plan: "Church Team", price: "$99", period: "/mo", productKey: "churchTeam",
    desc: "Pooled team usage · 5 seats · All Ministry features · Shared notes & sessions" },
] as const;
```

- [ ] **Step 2: Wire CheckoutLink / sign-up CTA**

Add imports to `hero.tsx` (note it must be/stay a client component — it already uses `useState`):

```tsx
import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";
```

Inside the component:

```tsx
  const user = useQuery(api.auth.getCurrentUser);
  const products = useQuery(api.polar.getConfiguredProducts);
```

In the pricing-card map, after `<p className={styles.pricingDesc}>{p.desc}</p>`, add a CTA:

```tsx
{(() => {
  const product = p.productKey ? products?.[p.productKey] : null;
  if (user && product) {
    return (
      <CheckoutLink
        polarApi={api.polar}
        productIds={[product.id]}
        className={styles.pricingCta}
      >
        Get {p.plan}
      </CheckoutLink>
    );
  }
  return (
    <Link
      href={user ? "/chat" : "/sign-up"}
      className={styles.pricingCta}
    >
      {p.productKey ? `Get ${p.plan}` : "Start free"}
    </Link>
  );
})()}
```

(Signed-out visitors — and the Free card always — go to `/sign-up`/`/chat`; signed-in users get a live checkout for paid cards.)

- [ ] **Step 3: Add the CTA style**

Append to `hero.module.css`, matching the card typography already there:

```css
.pricingCta {
  display: inline-block;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit` — clean. (If `products?.[p.productKey]` complains about index types, key off explicit checks: `p.productKey === "scholar" ? products?.scholar : ...`.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hero.tsx apps/web/src/components/hero.module.css
git commit -m "feat(web): live checkout links on landing pricing cards"
```

---

### Task 12: Surface USAGE_LIMIT errors in chat

**Files:**
- Create: `apps/web/src/components/chat/lib/usage-limit.ts`
- Test: `apps/web/src/components/chat/lib/usage-limit.test.ts`
- Modify: `apps/web/src/components/chat/chat-app.tsx`, `apps/web/src/components/chat/live-thread.tsx`

**Interfaces:**
- Consumes: `ConvexError` from `convex/values`; the `{ code: "USAGE_LIMIT", planId }` payload thrown by Task 4/6.
- Produces: `usageLimitMessage(error: unknown): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/chat/lib/usage-limit.test.ts
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import { usageLimitMessage } from "./usage-limit";

describe("usageLimitMessage", () => {
  test("free-plan limit", () => {
    const err = new ConvexError({ code: "USAGE_LIMIT", planId: "free" });
    expect(usageLimitMessage(err)).toBe(
      "You've used all 20 free queries this month. Upgrade for more.",
    );
  });

  test("paid-plan limit", () => {
    const err = new ConvexError({ code: "USAGE_LIMIT", planId: "scholar" });
    expect(usageLimitMessage(err)).toBe(
      "You've reached your weekly usage limit. Upgrade your plan or wait for the reset.",
    );
  });

  test("other errors return null", () => {
    expect(usageLimitMessage(new Error("boom"))).toBeNull();
    expect(usageLimitMessage(new ConvexError({ code: "OTHER" }))).toBeNull();
    expect(usageLimitMessage(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run usage-limit` (vitest config already includes `src`).
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// apps/web/src/components/chat/lib/usage-limit.ts
import { ConvexError } from "convex/values";

/** Message for a USAGE_LIMIT ConvexError; null for anything else. */
export function usageLimitMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: string; planId?: string } | undefined;
  if (data?.code !== "USAGE_LIMIT") return null;
  return data.planId === "free"
    ? "You've used all 20 free queries this month. Upgrade for more."
    : "You've reached your weekly usage limit. Upgrade your plan or wait for the reset.";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run usage-limit`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it at both send sites**

`chat-app.tsx` — replace the catch in `handleStart`:

```tsx
    } catch (error) {
      toast.error(
        usageLimitMessage(error) ??
          "Could not start the study. Please try again.",
      );
    }
```

with import `import { usageLimitMessage } from "./lib/usage-limit";`.

`live-thread.tsx` — replace the `.catch` in `send`:

```tsx
    sendMessage({ conversationId: conversation.convexId, text }).catch(
      (error) => {
        toast.error(
          usageLimitMessage(error) ??
            "Could not send the message. Please try again.",
        );
      },
    );
```

with import `import { usageLimitMessage } from "./lib/usage-limit";`.

The persistent upgrade affordances are the meter card's at-limit state and the free banner (Tasks 8–9); the toast is the immediate feedback.

- [ ] **Step 6: Typecheck + run web tests**

Run: `cd apps/web && bunx tsc --noEmit && bun run test`
Expected: clean, all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/chat/lib/usage-limit.ts apps/web/src/components/chat/lib/usage-limit.test.ts apps/web/src/components/chat/chat-app.tsx apps/web/src/components/chat/live-thread.tsx
git commit -m "feat(web): friendly usage-limit errors at both send sites"
```

---

### Task 13: PRICING.md reconciliation + final verification

**Files:**
- Modify: `docs/PRICING.md`

- [ ] **Step 1: Update PRICING.md**

Make these edits (keep the doc's voice; these are content changes, not a rewrite):

1. **Free tier row + section:** model is **Haiku 4.5**, enforcement is a **hard 20 queries/calendar month counter** (not a dollar budget); worst-case cost ~$0.30/user/month. Remove the "downgrading Free to Haiku is the escape hatch" line — it's now the baseline.
2. **Fair-Use Enforcement section:** replace items 1–2: limits are hard caps for paid tiers at 100% of the weekly window (monthly budget ÷ 4, resetting **Monday 00:00 UTC**); over-cap paid requests are blocked with an upgrade-or-wait message; free is the monthly query counter. Remove the Haiku-downgrade-at-120% mechanism (Haiku's role is now the free tier, noted in the model table).
3. **Model table:** Haiku 4.5's role becomes "Free tier — all free queries".

- [ ] **Step 2: Full verification pass**

```bash
cd packages/backend && bunx tsc -p convex && bun run test
cd ../../apps/web && bunx tsc --noEmit && bun run test
```

Expected: both clean.

Manual sandbox checklist (dev server + `bunx convex dev`):
1. Signed-in free user: banner visible; meter shows "0 / 20"; sending messages increments it; replies come from Haiku (check Convex logs for the model name).
2. Checkout Scholar via a pricing-card or meter CheckoutLink using Polar sandbox test card; after the webhook fires, meter flips to "Weekly usage …% · Scholar plan", banner disappears, user menu shows Manage Subscription.
3. Set 20 queries used for a free test user (temporarily via dashboard data editor) → send blocked with the free-tier toast.

- [ ] **Step 3: Commit**

```bash
git add docs/PRICING.md
git commit -m "docs: PRICING.md reflects free-on-Haiku query counter and hard weekly caps"
```
