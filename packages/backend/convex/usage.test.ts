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
